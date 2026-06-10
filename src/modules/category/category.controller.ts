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
import { CategoryService } from './category.service'
import { CreateCategoryDTO, UpdateCategoryDTO } from './category.dto'

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  list() {
    return this.categoryService.list()
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.detail(id)
  }

  @Post()
  @Auth()
  @SuccessMessage('创建分类成功')
  create(@Body() dto: CreateCategoryDTO) {
    return this.categoryService.create(dto)
  }

  @Put(':id')
  @Auth()
  @SuccessMessage('更新分类成功')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDTO) {
    return this.categoryService.update(id, dto)
  }

  @Delete(':id')
  @Auth(AuthorRole.SUPER_ADMIN)
  @SuccessMessage('删除分类成功')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.remove(id)
  }
}
