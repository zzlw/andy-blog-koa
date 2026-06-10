import { Model } from 'mongoose'
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { InjectModel } from '@/core/database/model.transformer'
import { CacheService } from '@/core/cache/cache.service'
import { EVENT_ARTICLE_CHANGED } from '@/constants/event.constant'
import { Article, ARTICLE_GUEST_FILTER } from '@/modules/article/article.model'

const ARCHIVE_CACHE_KEY = 'archive'
const ARCHIVE_CACHE_TTL = 60 * 60 // 1h 兜底过期；正常依赖事件失效

export interface ArchiveYear {
  year: number
  articles: Array<{ id: number; title: string; cover: string; created_date: Date }>
}

/**
 * 归档聚合：按年份分组的已发布文章索引。
 * 读多写少 → Redis 缓存 + 文章变更事件主动失效（事件驱动，仿 nodepress Archive）
 */
@Injectable()
export class ArchiveService {
  constructor(
    @InjectModel(Article) private readonly articleModel: Model<Article>,
    private readonly cacheService: CacheService,
  ) {}

  async getArchive(): Promise<ArchiveYear[]> {
    const cached = await this.cacheService.get<ArchiveYear[]>(ARCHIVE_CACHE_KEY)
    if (cached) return cached

    const archive = await this.buildArchive()
    await this.cacheService.set(ARCHIVE_CACHE_KEY, archive, ARCHIVE_CACHE_TTL)
    return archive
  }

  @OnEvent(EVENT_ARTICLE_CHANGED)
  async invalidate() {
    await this.cacheService.delete(ARCHIVE_CACHE_KEY)
  }

  private async buildArchive(): Promise<ArchiveYear[]> {
    const articles = await this.articleModel
      .find(ARTICLE_GUEST_FILTER, { id: 1, title: 1, cover: 1, created_date: 1, _id: 0 })
      .sort({ created_date: -1 })
      .lean()
      .exec()

    const yearMap = new Map<number, ArchiveYear>()
    for (const article of articles) {
      const year = new Date(article.created_date).getFullYear()
      if (!yearMap.has(year)) {
        yearMap.set(year, { year, articles: [] })
      }
      yearMap.get(year)!.articles.push(article as ArchiveYear['articles'][number])
    }
    return [...yearMap.values()].sort((a, b) => b.year - a.year)
  }
}
