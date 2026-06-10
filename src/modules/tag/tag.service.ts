import { Model } from 'mongoose'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@/core/database/model.transformer'
import { NotFoundException } from '@/common/exceptions/biz.exception'
import { Tag } from './tag.model'
import { CreateTagDTO, UpdateTagDTO } from './tag.dto'

@Injectable()
export class TagService {
  constructor(@InjectModel(Tag) private readonly tagModel: Model<Tag>) {}

  list() {
    return this.tagModel.find().sort({ id: 1 }).lean().exec()
  }

  create(dto: CreateTagDTO) {
    return this.tagModel.create({ ...dto })
  }

  async update(id: number, dto: UpdateTagDTO) {
    const tag = await this.tagModel
      .findOneAndUpdate({ id }, { $set: dto }, { new: true })
      .lean()
      .exec()
    if (!tag) throw new NotFoundException('标签不存在')
    return tag
  }

  async remove(id: number) {
    const result = await this.tagModel.deleteOne({ id }).exec()
    if (!result.deletedCount) throw new NotFoundException('标签不存在')
  }
}
