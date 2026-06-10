import { Module } from '@nestjs/common'
import { getModelProvider } from '@/core/database/model.transformer'
import { Article } from '@/modules/article/article.model'
import { ArchiveService } from './archive.service'

@Module({
  providers: [getModelProvider(Article), ArchiveService],
  exports: [ArchiveService],
})
export class ArchiveModule {}
