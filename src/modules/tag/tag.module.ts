import { Module } from '@nestjs/common'
import { getModelProvider } from '@/core/database/model.transformer'
import { Article } from '@/modules/article/article.model'
import { Tag } from './tag.model'
import { TagService } from './tag.service'
import { TagController } from './tag.controller'

@Module({
  controllers: [TagController],
  providers: [getModelProvider(Tag), getModelProvider(Article), TagService],
  exports: [TagService],
})
export class TagModule {}
