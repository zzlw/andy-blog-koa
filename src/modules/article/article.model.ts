import { AutoIncrementID } from '@typegoose/auto-increment'
import { index, modelOptions, plugin, prop } from '@typegoose/typegoose'

/** 文章可见性 */
export enum ArticlePublic {
  Public = 1,
  Private = 2,
}

/** 文章发布状态 */
export enum ArticleStatus {
  Published = 1,
  Draft = 2,
}

/** 精选标记（沿用旧值：2 = 精选） */
export enum ArticleStar {
  Normal = 1,
  Star = 2,
}

@plugin(AutoIncrementID, { field: 'id', startAt: 1 })
@index({ title: 'text', description: 'text' })
@modelOptions({
  schemaOptions: {
    collection: 'articles',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  },
})
export class Article {
  @prop({ unique: true, index: true })
  id?: number

  @prop({ required: true, trim: true, maxlength: 64 })
  title: string

  @prop({ required: true })
  content: string

  @prop({ default: '', maxlength: 255 })
  description: string

  @prop({ default: '' })
  cover: string

  /** 展示用发布日期（可由作者指定，区别于 created_at） */
  @prop({ default: () => new Date() })
  created_date: Date

  @prop({ default: null, index: true })
  category_id: number | null

  @prop({ type: () => [Number], default: [], index: true })
  tag_ids: number[]

  @prop({ type: () => [Number], default: [], index: true })
  author_ids: number[]

  @prop({ enum: ArticlePublic, default: ArticlePublic.Public, index: true })
  public: ArticlePublic

  @prop({ enum: ArticleStatus, default: ArticleStatus.Published, index: true })
  status: ArticleStatus

  @prop({ enum: ArticleStar, default: ArticleStar.Normal, index: true })
  star: ArticleStar

  @prop({ default: 0 })
  like: number

  @prop({ default: 0 })
  views: number
}

/** Guest 可见文章的强制过滤条件（对齐旧 frontShow scope） */
export const ARTICLE_GUEST_FILTER = Object.freeze({
  public: ArticlePublic.Public,
  status: ArticleStatus.Published,
})
