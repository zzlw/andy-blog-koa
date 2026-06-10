import { AutoIncrementID } from '@typegoose/auto-increment'
import { modelOptions, plugin, prop } from '@typegoose/typegoose'

@plugin(AutoIncrementID, { field: 'id', startAt: 1 })
@modelOptions({
  schemaOptions: {
    collection: 'messages',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  },
})
export class Message {
  @prop({ unique: true, index: true })
  id?: number

  @prop({ default: '匿名', trim: true, maxlength: 32 })
  nickname: string

  @prop({ required: true, maxlength: 1023 })
  content: string
}
