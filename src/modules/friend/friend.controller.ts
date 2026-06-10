import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common'
import { Auth } from '@/common/decorators/auth.decorator'
import { SuccessMessage } from '@/common/decorators/success-message.decorator'
import { FriendService } from './friend.service'
import { CreateFriendDTO, UpdateFriendDTO } from './friend.dto'

@Controller('friends')
export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  @Get()
  list() {
    return this.friendService.list()
  }

  @Post()
  @Auth()
  @SuccessMessage('创建友链成功')
  create(@Body() dto: CreateFriendDTO) {
    return this.friendService.create(dto)
  }

  @Put(':id')
  @Auth()
  @SuccessMessage('更新友链成功')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFriendDTO) {
    return this.friendService.update(id, dto)
  }

  @Delete(':id')
  @Auth()
  @SuccessMessage('删除友链成功')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.friendService.remove(id)
  }
}
