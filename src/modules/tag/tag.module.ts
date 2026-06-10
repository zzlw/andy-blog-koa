import { Module } from '@nestjs/common'
import { getModelProvider } from '@/core/database/model.transformer'
import { Tag } from './tag.model'
import { TagService } from './tag.service'
import { TagController } from './tag.controller'

@Module({
  controllers: [TagController],
  providers: [getModelProvider(Tag), TagService],
  exports: [TagService],
})
export class TagModule {}
