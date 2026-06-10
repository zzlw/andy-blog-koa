import { Module } from '@nestjs/common'
import { getModelProvider } from '@/core/database/model.transformer'
import { Author } from './author.model'
import { AuthorService } from './author.service'
import { AuthorController } from './author.controller'
import { AuthController } from './auth.controller'

@Module({
  controllers: [AuthController, AuthorController],
  providers: [getModelProvider(Author), AuthorService],
  exports: [AuthorService],
})
export class AuthorModule {}
