import { FastifyRequest } from 'fastify'
import { Controller, Logger, Post, Req } from '@nestjs/common'
import { Auth } from '@/common/decorators/auth.decorator'
import { SuccessMessage } from '@/common/decorators/success-message.decorator'
import { UploadFailedException } from '@/common/exceptions/biz.exception'
import { APP_CONFIG } from '@/app.config'
import { S3Service } from './s3.service'

/** 上传后的文件元信息（附件需要原始文件名/大小用于生成 Markdown 链接） */
interface UploadedFile {
  url: string
  name: string
  size: number
}

const toMB = (bytes: number) => Math.round(bytes / 1024 / 1024)

@Controller('files')
export class FileController {
  private readonly logger = new Logger(FileController.name)

  constructor(private readonly s3Service: S3Service) {}

  /**
   * 图片上传（单文件 ≤ 2MB），返回 result: { urls: string[] }
   * 小文件直接缓冲，按 fileSize 二次约束大小
   */
  @Post()
  @Auth()
  @SuccessMessage('上传成功')
  async upload(@Req() request: FastifyRequest) {
    const files = await this.collectBuffered(request, APP_CONFIG.upload.singleLimit, '图片')
    return { urls: files.map((file) => file.url) }
  }

  /**
   * 文章附件上传（单文件 ≤ 100MB，任意类型），返回 result: { files: [{ url, name, size }] }
   * 大文件流式上传，不缓冲到内存，避免 OOM
   */
  @Post('attachment')
  @Auth()
  @SuccessMessage('上传成功')
  async uploadAttachment(@Req() request: FastifyRequest) {
    const files = await this.collectStreamed(
      request,
      APP_CONFIG.upload.attachmentLimit,
      '附件',
      APP_CONFIG.s3.keyPrefix,
    )
    return { files }
  }

  /** 小文件：缓冲到内存后上传，逐文件按 sizeLimit 校验 */
  private async collectBuffered(
    request: FastifyRequest,
    sizeLimit: number,
    label: string,
  ): Promise<UploadedFile[]> {
    this.assertMultipart(request)
    const files: UploadedFile[] = []
    const parts = request.files({
      limits: { files: APP_CONFIG.upload.maxCount, fileSize: sizeLimit },
    })
    for await (const part of parts) {
      let buffer: Buffer
      try {
        buffer = await part.toBuffer()
      } catch (error) {
        throw this.normalizeError(error, label, sizeLimit, part.filename)
      }
      if (part.file.truncated || buffer.length > sizeLimit) {
        throw this.tooLargeError(label, sizeLimit, part.filename)
      }
      const url = await this.s3Service.upload(part.filename, buffer, part.mimetype)
      files.push({ url, name: part.filename, size: buffer.length })
    }
    if (!files.length) throw new UploadFailedException('未接收到文件')
    return files
  }

  /** 大文件：流式上传到对象存储，逐文件按 sizeLimit 校验 */
  private async collectStreamed(
    request: FastifyRequest,
    sizeLimit: number,
    label: string,
    prefix: string,
  ): Promise<UploadedFile[]> {
    this.assertMultipart(request)
    const files: UploadedFile[] = []
    const parts = request.files({
      limits: { files: APP_CONFIG.upload.maxCount, fileSize: sizeLimit },
    })
    for await (const part of parts) {
      try {
        const url = await this.s3Service.uploadStream(
          part.filename,
          part.file,
          part.mimetype,
          prefix,
        )
        if (part.file.truncated) throw this.tooLargeError(label, sizeLimit, part.filename)
        files.push({ url, name: part.filename, size: part.file.bytesRead })
      } catch (error) {
        throw this.normalizeError(error, label, sizeLimit, part.filename)
      }
    }
    if (!files.length) throw new UploadFailedException('未接收到文件')
    return files
  }

  private assertMultipart(request: FastifyRequest) {
    if (!request.isMultipart()) {
      throw new UploadFailedException('Content-Type 必须为 multipart/form-data')
    }
  }

  private tooLargeError(label: string, sizeLimit: number, filename: string) {
    return new UploadFailedException(`${label}「${filename}」超过大小上限 ${toMB(sizeLimit)}MB`)
  }

  /** 把底层流/SDK 异常转成友好的业务异常（超限单独提示，其余统一兜底） */
  private normalizeError(error: unknown, label: string, sizeLimit: number, filename: string) {
    if (error instanceof UploadFailedException) return error
    const code = (error as { code?: string })?.code
    if (code === 'FST_REQ_FILE_TOO_LARGE' || code === 'FST_FILES_LIMIT') {
      return this.tooLargeError(label, sizeLimit, filename)
    }
    this.logger.error(`上传失败「${filename}」: ${(error as Error)?.message}`)
    return new UploadFailedException(`${label}上传失败`)
  }
}
