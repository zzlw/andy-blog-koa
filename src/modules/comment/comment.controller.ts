import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Auth } from '@/common/decorators/auth.decorator'
import { SuccessMessage } from '@/common/decorators/success-message.decorator'
import { AuthorRole } from '@/constants/role.constant'
import { CommentService } from './comment.service'
import { CommentListQueryDTO, CreateCommentDTO } from './comment.dto'

@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get()
  list(@Query() query: CommentListQueryDTO) {
    return this.commentService.listByArticle(query.article_id)
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @SuccessMessage('评论成功')
  create(@Body() dto: CreateCommentDTO) {
    return this.commentService.create(dto)
  }

  @Post(':id/like')
  @SuccessMessage('点赞成功')
  like(@Param('id', ParseIntPipe) id: number) {
    return this.commentService.like(id)
  }

  @Delete(':id')
  @Auth(AuthorRole.SUPER_ADMIN)
  @SuccessMessage('删除评论成功')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.commentService.remove(id)
  }
}
