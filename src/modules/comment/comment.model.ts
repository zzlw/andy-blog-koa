import { AutoIncrementID } from '@typegoose/auto-increment'
import { modelOptions, plugin, prop } from '@typegoose/typegoose'

@plugin(AutoIncrementID, { field: 'id', startAt: 1 })
@modelOptions({
  schemaOptions: {
    collection: 'comments',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  },
})
export class Comment {
  @prop({ unique: true, index: true })
  id?: number

  @prop({ required: true, index: true })
  article_id: number

  /** 顶级评论为 0 */
  @prop({ default: 0, index: true })
  parent_id: number

  @prop({ required: true, trim: true, maxlength: 32 })
  nickname: string

  @prop({ required: true, maxlength: 1023 })
  content: string

  @prop({ default: 0 })
  like: number

  @prop({ default: '' })
  email: string

  @prop({ default: '' })
  website: string
}
