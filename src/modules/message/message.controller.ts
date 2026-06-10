import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Auth } from '@/common/decorators/auth.decorator'
import { SuccessMessage } from '@/common/decorators/success-message.decorator'
import { AuthorRole } from '@/constants/role.constant'
import { PaginateQueryDTO } from '@/common/dtos/paginate.dto'
import { MessageService } from './message.service'
import { CreateMessageDTO } from './message.dto'

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get()
  list(@Query() query: PaginateQueryDTO) {
    return this.messageService.list(query.page, query.page_size)
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @SuccessMessage('留言成功')
  create(@Body() dto: CreateMessageDTO) {
    return this.messageService.create(dto)
  }

  @Delete(':id')
  @Auth(AuthorRole.SUPER_ADMIN)
  @SuccessMessage('删除留言成功')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.messageService.remove(id)
  }
}
