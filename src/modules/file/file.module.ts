import { Module } from '@nestjs/common'
import { S3Service } from './s3.service'
import { FileController } from './file.controller'

@Module({
  controllers: [FileController],
  providers: [S3Service],
})
export class FileModule {}
