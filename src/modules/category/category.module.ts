import { Module } from '@nestjs/common'
import { getModelProvider } from '@/core/database/model.transformer'
import { Category } from './category.model'
import { CategoryService } from './category.service'
import { CategoryController } from './category.controller'

@Module({
  controllers: [CategoryController],
  providers: [getModelProvider(Category), CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
