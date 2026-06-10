import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Injectable, Logger } from '@nestjs/common'
import { APP_CONFIG } from '@/app.config'
import { UploadFailedException } from '@/common/exceptions/biz.exception'

/**
 * S3 兼容对象存储封装（参考 nodepress helper.service.s3）
 * 支持 AWS S3 / Cloudflare R2 / MinIO 等任意 S3 协议实现
 */
@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name)
  private readonly client = new S3Client({
    region: APP_CONFIG.s3.region,
    endpoint: APP_CONFIG.s3.endpoint,
    forcePathStyle: APP_CONFIG.s3.forcePathStyle,
    credentials: {
      accessKeyId: APP_CONFIG.s3.accessKeyId,
      secretAccessKey: APP_CONFIG.s3.secretAccessKey,
    },
  })

  /** 上传 buffer，返回浏览器可达的完整 URL（同名 key 覆盖，与旧系统行为一致） */
  async upload(filename: string, buffer: Buffer, contentType?: string): Promise<string> {
    const key = `${APP_CONFIG.s3.keyPrefix}${filename}`
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: APP_CONFIG.s3.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000',
        }),
      )
      return `${APP_CONFIG.s3.publicUrl}${key}`
    } catch (error) {
      this.logger.error(`S3 upload failed: ${(error as Error).message}`)
      throw new UploadFailedException()
    }
  }
}
