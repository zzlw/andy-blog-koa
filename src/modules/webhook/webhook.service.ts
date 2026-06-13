import { createHmac } from 'node:crypto'
import { Model } from 'mongoose'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { InjectModel } from '@/core/database/model.transformer'
import { APP_CONFIG } from '@/app.config'
import { EVENT_ARTICLE_DELETED, EVENT_ARTICLE_UPSERTED } from '@/constants/event.constant'
import { Category } from '@/modules/category/category.model'
import { Tag } from '@/modules/tag/tag.model'
import { Author, AUTHOR_SAFE_PROJECTION } from '@/modules/author/author.model'
import {
  Article,
  ARTICLE_GUEST_FILTER,
  ArticlePublic,
  ArticleStar,
  ArticleStatus,
} from '@/modules/article/article.model'
import {
  WebhookArticlePayload,
  WebhookEvent,
  WebhookOptionsPayload,
} from './webhook.constant'

/** 单次 upsert_articles 批量上限，避免单个请求体过大 */
const ARTICLE_SYNC_BATCH_SIZE = 20

@Injectable()
export class WebhookService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WebhookService.name)
  private readonly config = APP_CONFIG.webhook

  constructor(
    @InjectModel(Article) private readonly articleModel: Model<Article>,
    @InjectModel(Category) private readonly categoryModel: Model<Category>,
    @InjectModel(Tag) private readonly tagModel: Model<Tag>,
    @InjectModel(Author) private readonly authorModel: Model<Author>,
  ) {}

  private get enabled(): boolean {
    return Boolean(this.config.endpoint && this.config.secret)
  }

  /** 启动后同步一次站点/作者信息，确保 AI 服务的 System Prompt 上下文存在 */
  async onApplicationBootstrap() {
    if (!this.enabled) return
    // 不阻塞启动，后台执行；失败仅记录日志
    void this.syncOptions().catch((error) =>
      this.logger.warn(`启动同步站点信息失败：${(error as Error).message}`),
    )
  }

  /** 文章创建/更新：已发布且公开 → 同步内容；否则从知识库移除（草稿/私有不进 RAG） */
  @OnEvent(EVENT_ARTICLE_UPSERTED)
  async onArticleUpserted(article: Article) {
    if (!this.enabled || article.id == null) return
    if (article.status === ArticleStatus.Published && article.public === ArticlePublic.Public) {
      const payload = await this.buildArticlePayload(article)
      await this.dispatch(WebhookEvent.UpsertArticles, [payload])
    } else {
      await this.dispatch(WebhookEvent.DeleteArticles, [article.id])
    }
  }

  /** 文章删除 → 从知识库移除 */
  @OnEvent(EVENT_ARTICLE_DELETED)
  async onArticleDeleted(id: number) {
    if (!this.enabled) return
    await this.dispatch(WebhookEvent.DeleteArticles, [id])
  }

  /** 全量回填：站点信息 + 所有已发布公开文章（供初始化或手动重建知识库） */
  async syncAll() {
    if (!this.enabled) {
      throw new Error('Webhook 未配置（缺少 WEBHOOK_ENDPOINT 或 WEBHOOK_SECRET）')
    }
    await this.syncOptions()
    const articleCount = await this.syncAllArticles()
    return { options: true, articles: articleCount }
  }

  /** 同步站点 + 作者信息到 AI 知识库 */
  async syncOptions() {
    const payload = await this.buildOptionsPayload()
    await this.dispatch(WebhookEvent.UpsertOptions, payload)
  }

  /** 同步所有已发布且公开的文章（分批） */
  async syncAllArticles(): Promise<number> {
    const articles = await this.articleModel.find(ARTICLE_GUEST_FILTER).lean().exec()
    for (let i = 0; i < articles.length; i += ARTICLE_SYNC_BATCH_SIZE) {
      const batch = articles.slice(i, i + ARTICLE_SYNC_BATCH_SIZE)
      const payloads = await Promise.all(batch.map((article) => this.buildArticlePayload(article)))
      await this.dispatch(WebhookEvent.UpsertArticles, payloads)
    }
    return articles.length
  }

  /** 组装文章 payload：数字 ID 关联 → 分类/标签名 */
  private async buildArticlePayload(article: Article): Promise<WebhookArticlePayload> {
    const [category, tags] = await Promise.all([
      article.category_id != null
        ? this.categoryModel.findOne({ id: article.category_id }).lean().exec()
        : null,
      article.tag_ids?.length
        ? this.tagModel.find({ id: { $in: article.tag_ids } }).lean().exec()
        : [],
    ])

    const toISO = (value?: Date | string | null) =>
      value ? new Date(value).toISOString() : new Date().toISOString()

    return {
      id: article.id!,
      title: article.title,
      summary: article.description ?? '',
      keywords: (tags ?? []).map((tag) => tag.name),
      content: article.content,
      thumbnail: article.cover ?? '',
      origin: '',
      lang: 'zh',
      featured: article.star === ArticleStar.Star,
      disabled_comments: false,
      tags: (tags ?? []).map((tag) => ({ name: tag.name, slug: tag.name })),
      categories: category ? [{ name: category.name, slug: category.name }] : [],
      stats: { likes: article.like ?? 0, views: article.views ?? 0, comments: 0 },
      extras: [],
      created_at: toISO(article.created_date ?? (article as any).created_at),
      updated_at: toISO((article as any).updated_at ?? article.created_date),
    }
  }

  /** 组装站点/作者信息 payload：站点取自配置，作者简介取主账号 */
  private async buildOptionsPayload(): Promise<WebhookOptionsPayload> {
    const author = await this.authorModel
      .findOne({}, AUTHOR_SAFE_PROJECTION)
      .sort({ role: -1, id: 1 }) // 优先超级管理员（role 值更大），其次最早创建的作者
      .lean()
      .exec()

    const site = APP_CONFIG.site
    return {
      title: site.name,
      sub_title: '',
      description: site.description,
      keywords: site.keywords,
      site_url: site.url,
      site_email: author?.email ?? '',
      statement: site.description,
      friend_links: [],
      app_config: JSON.stringify({ ABOUT_BIOGRAPHY_ZH: author?.description ?? '' }),
    }
  }

  /** 签名并发送 Webhook；fire-and-forget，失败仅记录日志，不影响主流程 */
  private async dispatch(event: WebhookEvent, payload: unknown): Promise<void> {
    if (!this.enabled) return

    const timestamp = Date.now()
    // 签名基于请求体原文，AI 服务侧用相同算法重算比对（须与序列化结果字节一致）
    const body = JSON.stringify({ event, payload, timestamp })
    const signature = createHmac('sha256', this.config.secret).update(body).digest('hex')

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp.toString(),
        },
        body,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      })
      if (!response.ok) {
        this.logger.warn(`Webhook ${event} 响应异常：HTTP ${response.status}`)
      } else {
        this.logger.log(`Webhook ${event} 已发送`)
      }
    } catch (error) {
      this.logger.warn(`Webhook ${event} 发送失败：${(error as Error).message}`)
    }
  }
}
