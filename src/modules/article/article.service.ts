import { FilterQuery, Model } from 'mongoose'
import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { InjectModel } from '@/core/database/model.transformer'
import { NotFoundException } from '@/common/exceptions/biz.exception'
import { paginate } from '@/common/helpers/paginate.helper'
import { IdentityType, RequestIdentity } from '@/constants/role.constant'
import {
  EVENT_ARTICLE_CHANGED,
  EVENT_ARTICLE_DELETED,
  EVENT_ARTICLE_UPSERTED,
} from '@/constants/event.constant'
import { Category } from '@/modules/category/category.model'
import { Tag } from '@/modules/tag/tag.model'
import { Author, AUTHOR_SAFE_PROJECTION } from '@/modules/author/author.model'
import { Article, ARTICLE_GUEST_FILTER } from './article.model'
import { ArticleListQueryDTO, CreateArticleDTO, UpdateArticleDTO } from './article.dto'

const LIST_PROJECTION = { content: 0 }
const RELATED_LIMIT = 6

@Injectable()
export class ArticleService {
  constructor(
    @InjectModel(Article) private readonly articleModel: Model<Article>,
    @InjectModel(Category) private readonly categoryModel: Model<Category>,
    @InjectModel(Tag) private readonly tagModel: Model<Tag>,
    @InjectModel(Author) private readonly authorModel: Model<Author>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private isAuthor(identity: RequestIdentity): boolean {
    return identity.type === IdentityType.Author
  }

  /** 列表：Guest 强制只见「已发布 + 公开」 */
  async list(query: ArticleListQueryDTO, identity: RequestIdentity) {
    const filter: FilterQuery<Article> = {}

    if (query.category_id !== undefined) filter.category_id = query.category_id
    if (query.tag_id !== undefined) filter.tag_ids = query.tag_id
    if (query.author_id !== undefined) filter.author_ids = query.author_id
    if (query.star !== undefined) filter.star = query.star
    if (query.keyword) {
      const keyword = new RegExp(query.keyword.trim(), 'i')
      filter.$or = [{ title: keyword }, { description: keyword }]
    }

    if (this.isAuthor(identity)) {
      if (query.public !== undefined) filter.public = query.public
      if (query.status !== undefined) filter.status = query.status
    } else {
      Object.assign(filter, ARTICLE_GUEST_FILTER)
    }

    const result = await paginate(this.articleModel, filter, {
      page: query.page,
      pageSize: query.page_size,
      sort: { created_date: -1, id: -1 },
      projection: LIST_PROJECTION,
    })

    const data = await this.populateRelations(result.data)
    return { ...result, data }
  }

  /** 详情：组装分类/标签/作者/相关文章，Guest 访问自增阅读数 */
  async detail(id: number, identity: RequestIdentity) {
    const filter: FilterQuery<Article> = { id }
    if (!this.isAuthor(identity)) {
      Object.assign(filter, ARTICLE_GUEST_FILTER)
    }

    const article = await this.articleModel
      .findOneAndUpdate(filter, this.isAuthor(identity) ? {} : { $inc: { views: 1 } }, {
        new: true,
      })
      .lean()
      .exec()
    if (!article) throw new NotFoundException('文章不存在')

    const [populated] = await this.populateRelations([article])
    const related = article.category_id
      ? await this.articleModel
          .find(
            {
              ...ARTICLE_GUEST_FILTER,
              category_id: article.category_id,
              id: { $ne: article.id },
            },
            { id: 1, title: 1, cover: 1, created_date: 1, _id: 0 },
          )
          .sort({ created_date: -1 })
          .limit(RELATED_LIMIT)
          .lean()
          .exec()
      : []

    return { ...populated, related }
  }

  async create(dto: CreateArticleDTO) {
    const article = await this.articleModel.create({ ...dto })
    this.eventEmitter.emit(EVENT_ARTICLE_CHANGED)
    this.eventEmitter.emit(EVENT_ARTICLE_UPSERTED, article.toObject())
    return article
  }

  async update(id: number, dto: UpdateArticleDTO) {
    const article = await this.articleModel
      .findOneAndUpdate({ id }, { $set: dto }, { new: true })
      .lean()
      .exec()
    if (!article) throw new NotFoundException('文章不存在')
    this.eventEmitter.emit(EVENT_ARTICLE_CHANGED)
    this.eventEmitter.emit(EVENT_ARTICLE_UPSERTED, article)
    return article
  }

  async remove(id: number) {
    const result = await this.articleModel.deleteOne({ id }).exec()
    if (!result.deletedCount) throw new NotFoundException('文章不存在')
    this.eventEmitter.emit(EVENT_ARTICLE_CHANGED)
    this.eventEmitter.emit(EVENT_ARTICLE_DELETED, id)
  }

  async like(id: number) {
    const article = await this.articleModel
      .findOneAndUpdate(
        { id, ...ARTICLE_GUEST_FILTER },
        { $inc: { like: 1 } },
        { new: true, projection: { like: 1, _id: 0 } },
      )
      .lean()
      .exec()
    if (!article) throw new NotFoundException('文章不存在')
    return { like: article.like }
  }

  /** 数字 ID 关联 → 实体内联（category / tags / authors） */
  private async populateRelations(articles: Article[]) {
    if (!articles.length) return articles as any[]

    const categoryIds = [...new Set(articles.map((a) => a.category_id).filter(Boolean))]
    const tagIds = [...new Set(articles.flatMap((a) => a.tag_ids ?? []))]
    const authorIds = [...new Set(articles.flatMap((a) => a.author_ids ?? []))]

    const [categories, tags, authors] = await Promise.all([
      this.categoryModel.find({ id: { $in: categoryIds } }).lean().exec(),
      this.tagModel.find({ id: { $in: tagIds } }).lean().exec(),
      this.authorModel.find({ id: { $in: authorIds } }, AUTHOR_SAFE_PROJECTION).lean().exec(),
    ])

    const categoryMap = new Map(categories.map((item) => [item.id, item]))
    const tagMap = new Map(tags.map((item) => [item.id, item]))
    const authorMap = new Map(authors.map((item) => [item.id, item]))

    return articles.map((article) => ({
      ...article,
      category: article.category_id ? (categoryMap.get(article.category_id) ?? null) : null,
      tags: (article.tag_ids ?? []).map((id) => tagMap.get(id)).filter(Boolean),
      authors: (article.author_ids ?? []).map((id) => authorMap.get(id)).filter(Boolean),
    }))
  }
}
