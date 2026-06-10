import { AutoIncrementID } from '@typegoose/auto-increment'
import { modelOptions, plugin, prop } from '@typegoose/typegoose'

@plugin(AutoIncrementID, { field: 'id', startAt: 1 })
@modelOptions({
  schemaOptions: {
    collection: 'friends',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  },
})
export class Friend {
  @prop({ unique: true, index: true })
  id?: number

  @prop({ required: true, trim: true, maxlength: 64 })
  name: string

  @prop({ required: true })
  link: string

  @prop({ default: '' })
  avatar: string
}
