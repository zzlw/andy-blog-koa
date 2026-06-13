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
    // 留言板按创建时间倒序：最新留言置顶（id 作同毫秒兜底，不依赖自增 id 顺序）
    return paginate(this.messageModel, {}, { page, pageSize, sort: { created_at: -1, id: -1 } })
  }

  create(dto: CreateMessageDTO) {
    return this.messageModel.create({ ...dto })
  }

  async remove(id: number) {
    const result = await this.messageModel.deleteOne({ id }).exec()
    if (!result.deletedCount) throw new NotFoundException('留言不存在')
  }
}
