import { AutoIncrementID } from '@typegoose/auto-increment'
import { modelOptions, plugin, prop } from '@typegoose/typegoose'
import { AuthorRole } from '@/constants/role.constant'

@plugin(AutoIncrementID, { field: 'id', startAt: 1 })
@modelOptions({
  schemaOptions: {
    collection: 'authors',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  },
})
export class Author {
  @prop({ unique: true, index: true })
  id?: number

  @prop({ required: true, unique: true, trim: true, maxlength: 32 })
  name: string

  @prop({ default: '' })
  avatar: string

  @prop({ default: '' })
  email: string

  @prop({ default: '', maxlength: 255 })
  description: string

  @prop({ enum: AuthorRole, default: AuthorRole.AUTHOR })
  role: AuthorRole

  /** bcrypt 哈希，默认查询不返回 */
  @prop({ required: true, select: false })
  password: string
}

/** 对外暴露的安全字段投影 */
export const AUTHOR_SAFE_PROJECTION = Object.freeze({
  _id: 0,
  id: 1,
  name: 1,
  avatar: 1,
  email: 1,
  description: 1,
  role: 1,
})
