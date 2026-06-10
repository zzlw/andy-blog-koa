import { Module } from '@nestjs/common'
import { getModelProvider } from '@/core/database/model.transformer'
import { Article } from '@/modules/article/article.model'
import { Comment } from './comment.model'
import { CommentService } from './comment.service'
import { CommentController } from './comment.controller'

@Module({
  controllers: [CommentController],
  providers: [getModelProvider(Comment), getModelProvider(Article), CommentService],
  exports: [CommentService],
})
export class CommentModule {}
