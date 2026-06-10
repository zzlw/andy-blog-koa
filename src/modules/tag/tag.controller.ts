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
import { AuthorRole } from '@/constants/role.constant'
import { TagService } from './tag.service'
import { CreateTagDTO, UpdateTagDTO } from './tag.dto'

@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  list() {
    return this.tagService.list()
  }

  @Post()
  @Auth()
  @SuccessMessage('创建标签成功')
  create(@Body() dto: CreateTagDTO) {
    return this.tagService.create(dto)
  }

  @Put(':id')
  @Auth()
  @SuccessMessage('更新标签成功')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTagDTO) {
    return this.tagService.update(id, dto)
  }

  @Delete(':id')
  @Auth(AuthorRole.SUPER_ADMIN)
  @SuccessMessage('删除标签成功')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tagService.remove(id)
  }
}
