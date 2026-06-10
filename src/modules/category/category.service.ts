import { Model } from 'mongoose'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@/core/database/model.transformer'
import { NotFoundException } from '@/common/exceptions/biz.exception'
import { Category } from './category.model'
import { CreateCategoryDTO, UpdateCategoryDTO } from './category.dto'

@Injectable()
export class CategoryService {
  constructor(@InjectModel(Category) private readonly categoryModel: Model<Category>) {}

  list() {
    return this.categoryModel.find().sort({ id: 1 }).lean().exec()
  }

  async detail(id: number) {
    const category = await this.categoryModel.findOne({ id }).lean().exec()
    if (!category) throw new NotFoundException('分类不存在')
    return category
  }

  create(dto: CreateCategoryDTO) {
    return this.categoryModel.create({ ...dto })
  }

  async update(id: number, dto: UpdateCategoryDTO) {
    const category = await this.categoryModel
      .findOneAndUpdate({ id }, { $set: dto }, { new: true })
      .lean()
      .exec()
    if (!category) throw new NotFoundException('分类不存在')
    return category
  }

  async remove(id: number) {
    const result = await this.categoryModel.deleteOne({ id }).exec()
    if (!result.deletedCount) throw new NotFoundException('分类不存在')
  }
}
