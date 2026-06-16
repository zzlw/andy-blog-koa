import { AutoIncrementID } from '@typegoose/auto-increment'
import { modelOptions, plugin, prop } from '@typegoose/typegoose'

@plugin(AutoIncrementID, { field: 'id', startAt: 1 })
@modelOptions({
  schemaOptions: {
    collection: 'songs',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  },
})
export class Song {
  @prop({ unique: true, index: true })
  id?: number

  /** 曲名（APlayer 的 title，可含 .mp3 后缀，沿用旧数据习惯） */
  @prop({ required: true, trim: true, maxlength: 200 })
  name: string

  /** 歌手/艺术家 */
  @prop({ default: '', trim: true, maxlength: 200 })
  artist: string

  /** 音频相对路径（如 /music/xxx.mp3），展示时前端拼接 STATIC_PATH */
  @prop({ required: true, trim: true })
  url: string

  /** 封面相对路径 */
  @prop({ default: '/blog/asdf-avatar.jpg' })
  cover: string

  /** 排序权重，越小越靠前；默认按导入顺序 */
  @prop({ default: 0, index: true })
  sort: number
}
