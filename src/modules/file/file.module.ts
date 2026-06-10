import { Module } from '@nestjs/common'
import { QiniuService } from './qiniu.service'
import { FileController } from './file.controller'

@Module({
  controllers: [FileController],
  providers: [QiniuService],
})
export class FileModule {}
