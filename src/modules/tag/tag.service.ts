import { Model } from 'mongoose'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@/core/database/model.transformer'
import { NotFoundException } from '@/common/exceptions/biz.exception'
import { Article, ARTICLE_GUEST_FILTER } from '@/modules/article/article.model'
import { Tag } from './tag.model'
import { CreateTagDTO, UpdateTagDTO } from './tag.dto'

@Injectable()
export class TagService {
  constructor(
    @InjectModel(Tag) private readonly tagModel: Model<Tag>,
    @InjectModel(Article) private readonly articleModel: Model<Article>,
  ) {}

  /** 列表：附带「已发布且公开」文章计数，供前端做热门排序与隐藏空标签 */
  async list() {
    const [tags, counts] = await Promise.all([
      this.tagModel.find().sort({ id: 1 }).lean().exec(),
      this.articleModel.aggregate<{ _id: number; count: number }>([
        { $match: ARTICLE_GUEST_FILTER },
        { $unwind: '$tag_ids' },
        { $group: { _id: '$tag_ids', count: { $sum: 1 } } },
      ]),
    ])
    const countMap = new Map(counts.map((c) => [c._id, c.count]))
    return tags.map((tag) => ({ ...tag, article_count: countMap.get(tag.id!) ?? 0 }))
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
