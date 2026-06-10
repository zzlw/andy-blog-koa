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
import { Identity } from '@/common/decorators/identity.decorator'
import { SuccessMessage } from '@/common/decorators/success-message.decorator'
import { AuthorRole, RequestIdentity } from '@/constants/role.constant'
import { AuthorService } from './author.service'
import { CreateAuthorDTO, ResetPasswordDTO, UpdateAuthorDTO } from './author.dto'

@Controller('authors')
export class AuthorController {
  constructor(private readonly authorService: AuthorService) {}

  @Get()
  list() {
    return this.authorService.list()
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.authorService.detail(id)
  }

  @Post()
  @Auth(AuthorRole.SUPER_ADMIN)
  @SuccessMessage('创建作者成功')
  create(@Body() dto: CreateAuthorDTO) {
    return this.authorService.create(dto)
  }

  @Put(':id')
  @Auth()
  @SuccessMessage('更新作者成功')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAuthorDTO) {
    return this.authorService.update(id, dto)
  }

  @Put(':id/password')
  @Auth(AuthorRole.SUPER_ADMIN)
  @SuccessMessage('重置密码成功')
  resetPassword(@Param('id', ParseIntPipe) id: number, @Body() dto: ResetPasswordDTO) {
    return this.authorService.resetPassword(id, dto)
  }

  @Delete(':id')
  @Auth(AuthorRole.SUPER_ADMIN)
  @SuccessMessage('删除作者成功')
  remove(@Param('id', ParseIntPipe) id: number, @Identity() identity: RequestIdentity) {
    return this.authorService.remove(id, identity.authorId!)
  }
}
