import { Readable } from 'node:stream'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
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
    // AWS SDK >= 3.729 默认给 Put/Get 注入 CRC32 校验头（x-amz-checksum-crc32），
    // 阿里云 OSS / R2 等 S3 兼容实现不支持，会直接拒绝请求导致上传失败，
    // 故改回「仅在 API 要求时」才计算校验和
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })

  /**
   * 上传 buffer，返回「相对路径」（如 /blog/xxx.jpg），不含域名。
   * 域名/协议由前端用 STATIC_PATH 在渲染时拼接，这样换域名/换协议只改环境变量，
   * 无需改动数据库存量数据。同名 key 覆盖，与旧系统行为一致。
   *
   * @param prefix 对象 key 前缀（默认 blog/）；音乐用 music/，与线上 OSS 既有目录对齐
   *
   * 返回值对文件名做 URL 编码（空格/中文/符号 → %XX），保证浏览器可直接请求；
   * 而 S3 object key 仍用原始文件名，与既有数据保持一致。
   */
  async upload(
    filename: string,
    buffer: Buffer,
    contentType?: string,
    prefix: string = APP_CONFIG.s3.keyPrefix,
  ): Promise<string> {
    const key = `${prefix}${filename}`
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
      return `/${prefix}${encodeURIComponent(filename)}`
    } catch (error) {
      this.logger.error(`S3 upload failed: ${(error as Error).message}`)
      throw new UploadFailedException()
    }
  }

  /**
   * 流式上传（@aws-sdk/lib-storage 自动分片），适合音频/附件等大文件，
   * 全程不把整个文件缓冲进内存，避免 OOM。其余语义同 upload()。
   *
   * 上传过程中若流报错（如 multipart fileSize 超限被截断），Upload 会抛错并
   * 自动 abort 已开始的分片，调用方据此返回友好错误。
   */
  async uploadStream(
    filename: string,
    body: Readable,
    contentType?: string,
    prefix: string = APP_CONFIG.s3.keyPrefix,
  ): Promise<string> {
    const key = `${prefix}${filename}`
    const uploader = new Upload({
      client: this.client,
      params: {
        Bucket: APP_CONFIG.s3.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000',
      },
    })
    await uploader.done()
    return `/${prefix}${encodeURIComponent(filename)}`
  }
}
