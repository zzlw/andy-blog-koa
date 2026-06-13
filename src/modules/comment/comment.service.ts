import { Model } from 'mongoose'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@/core/database/model.transformer'
import {
  NotFoundException,
  ValidationFailedException,
} from '@/common/exceptions/biz.exception'
import { Article } from '@/modules/article/article.model'
import { Comment } from './comment.model'
import { CreateCommentDTO } from './comment.dto'

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(Comment) private readonly commentModel: Model<Comment>,
    @InjectModel(Article) private readonly articleModel: Model<Article>,
  ) {}

  /** 指定文章的全部评论（扁平结构，parent_id 关联，由前端组装树）
   *  按创建时间正序：顶层评论与各楼层回复都按时间先后排列（符合阅读顺序与“抢沙发”习惯），
   *  id 作为同一毫秒下的稳定兜底，避免依赖自增 id 顺序。 */
  listByArticle(articleId: number) {
    return this.commentModel
      .find({ article_id: articleId })
      .sort({ created_at: 1, id: 1 })
      .lean()
      .exec()
  }

  async create(dto: CreateCommentDTO) {
    const article = await this.articleModel.exists({ id: dto.article_id })
    if (!article) throw new NotFoundException('文章不存在')

    if (dto.parent_id) {
      const parent = await this.commentModel
        .findOne({ id: dto.parent_id, article_id: dto.article_id })
        .lean()
        .exec()
      if (!parent) throw new ValidationFailedException('被回复的评论不存在')
    }

    return this.commentModel.create({ ...dto, parent_id: dto.parent_id ?? 0 })
  }

  async like(id: number) {
    const comment = await this.commentModel
      .findOneAndUpdate({ id }, { $inc: { like: 1 } }, { new: true })
      .lean()
      .exec()
    if (!comment) throw new NotFoundException('评论不存在')
    return { like: comment.like }
  }

  async remove(id: number) {
    const result = await this.commentModel.deleteOne({ id }).exec()
    if (!result.deletedCount) throw new NotFoundException('评论不存在')
  }
}
