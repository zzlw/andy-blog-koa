import { Module } from '@nestjs/common'
import { getModelProvider } from '@/core/database/model.transformer'
import { FileModule } from '@/modules/file/file.module'
import { Song } from './music.model'
import { MusicController } from './music.controller'
import { MusicService } from './music.service'

@Module({
  imports: [FileModule],
  controllers: [MusicController],
  providers: [getModelProvider(Song), MusicService],
  exports: [MusicService],
})
export class MusicModule {}
