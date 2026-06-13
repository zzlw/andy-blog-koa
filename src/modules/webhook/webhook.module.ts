import { Module } from '@nestjs/common'
import { getModelProvider } from '@/core/database/model.transformer'
import { Article } from '@/modules/article/article.model'
import { Category } from '@/modules/category/category.model'
import { Tag } from '@/modules/tag/tag.model'
import { Author } from '@/modules/author/author.model'
import { WebhookService } from './webhook.service'
import { WebhookController } from './webhook.controller'

@Module({
  controllers: [WebhookController],
  providers: [
    getModelProvider(Article),
    getModelProvider(Category),
    getModelProvider(Tag),
    getModelProvider(Author),
    WebhookService,
  ],
  exports: [WebhookService],
})
export class WebhookModule {}
