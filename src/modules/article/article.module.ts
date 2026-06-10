import { Module } from '@nestjs/common'
import { getModelProvider } from '@/core/database/model.transformer'
import { Category } from '@/modules/category/category.model'
import { Tag } from '@/modules/tag/tag.model'
import { Author } from '@/modules/author/author.model'
import { ArchiveModule } from '@/modules/archive/archive.module'
import { Article } from './article.model'
import { ArticleService } from './article.service'
import { ArticleController } from './article.controller'

@Module({
  imports: [ArchiveModule],
  controllers: [ArticleController],
  providers: [
    getModelProvider(Article),
    getModelProvider(Category),
    getModelProvider(Tag),
    getModelProvider(Author),
    ArticleService,
  ],
  exports: [ArticleService],
})
export class ArticleModule {}
