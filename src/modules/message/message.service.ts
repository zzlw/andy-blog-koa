import { Model } from 'mongoose'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@/core/database/model.transformer'
import { NotFoundException } from '@/common/exceptions/biz.exception'
import { paginate } from '@/common/helpers/paginate.helper'
import { Message } from './message.model'
import { CreateMessageDTO } from './message.dto'

@Injectable()
export class MessageService {
  constructor(@InjectModel(Message) private readonly messageModel: Model<Message>) {}

  list(page?: number, pageSize?: number) {
    return paginate(this.messageModel, {}, { page, pageSize, sort: { id: -1 } })
  }

  create(dto: CreateMessageDTO) {
    return this.messageModel.create({ ...dto })
  }

  async remove(id: number) {
    const result = await this.messageModel.deleteOne({ id }).exec()
    if (!result.deletedCount) throw new NotFoundException('留言不存在')
  }
}
