import { AutoIncrementID } from '@typegoose/auto-increment'
import { modelOptions, plugin, prop } from '@typegoose/typegoose'

@plugin(AutoIncrementID, { field: 'id', startAt: 1 })
@modelOptions({
  schemaOptions: {
    collection: 'categories',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  },
})
export class Category {
  @prop({ unique: true, index: true })
  id?: number

  @prop({ required: true, trim: true, maxlength: 64 })
  name: string

  @prop({ default: '', maxlength: 255 })
  description: string

  @prop({ default: '' })
  cover: string
}
