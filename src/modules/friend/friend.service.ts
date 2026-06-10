import { Model } from 'mongoose'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@/core/database/model.transformer'
import { NotFoundException } from '@/common/exceptions/biz.exception'
import { Friend } from './friend.model'
import { CreateFriendDTO, UpdateFriendDTO } from './friend.dto'

@Injectable()
export class FriendService {
  constructor(@InjectModel(Friend) private readonly friendModel: Model<Friend>) {}

  list() {
    return this.friendModel.find().sort({ id: 1 }).lean().exec()
  }

  create(dto: CreateFriendDTO) {
    return this.friendModel.create({ ...dto })
  }

  async update(id: number, dto: UpdateFriendDTO) {
    const friend = await this.friendModel
      .findOneAndUpdate({ id }, { $set: dto }, { new: true })
      .lean()
      .exec()
    if (!friend) throw new NotFoundException('友链不存在')
    return friend
  }

  async remove(id: number) {
    const result = await this.friendModel.deleteOne({ id }).exec()
    if (!result.deletedCount) throw new NotFoundException('友链不存在')
  }
}
