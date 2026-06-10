import { FastifyRequest } from 'fastify'
import { Controller, Post, Req } from '@nestjs/common'
import { Auth } from '@/common/decorators/auth.decorator'
import { SuccessMessage } from '@/common/decorators/success-message.decorator'
import { UploadFailedException } from '@/common/exceptions/biz.exception'
import { APP_CONFIG } from '@/app.config'
import { QiniuService } from './qiniu.service'

@Controller('files')
export class FileController {
  constructor(private readonly qiniuService: QiniuService) {}

  /**
   * multipart 上传（单文件/总数限制由 @fastify/multipart 在 main.ts 注册时约束）
   * 返回 result: { urls: string[] }
   */
  @Post()
  @Auth()
  @SuccessMessage('上传成功')
  async upload(@Req() request: FastifyRequest) {
    if (!request.isMultipart()) {
      throw new UploadFailedException('Content-Type 必须为 multipart/form-data')
    }

    const urls: string[] = []
    const parts = request.files({ limits: { files: APP_CONFIG.upload.maxCount } })
    for await (const part of parts) {
      const buffer = await part.toBuffer()
      urls.push(await this.qiniuService.upload(part.filename, buffer))
    }

    if (!urls.length) throw new UploadFailedException('未接收到文件')
    return { urls }
  }
}
