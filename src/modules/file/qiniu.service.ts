import * as qiniu from 'qiniu'
import { Injectable, Logger } from '@nestjs/common'
import { APP_CONFIG } from '@/app.config'
import { UploadFailedException } from '@/common/exceptions/biz.exception'

/**
 * 七牛云对象存储封装（与具体业务解耦的 Uploader 抽象）
 */
@Injectable()
export class QiniuService {
  private readonly logger = new Logger(QiniuService.name)
  private readonly mac = new qiniu.auth.digest.Mac(
    APP_CONFIG.qiniu.accessKey,
    APP_CONFIG.qiniu.secretKey,
  )
  private readonly uploader = new qiniu.form_up.FormUploader(
    new qiniu.conf.Config({ useHttpsDomain: true, zone: qiniu.zone.Zone_z0 }),
  )

  /** 上传 buffer，返回 CDN 完整 URL */
  upload(filename: string, buffer: Buffer): Promise<string> {
    const key = `${APP_CONFIG.qiniu.keyPrefix}${filename}`
    // scope 含 key：允许覆盖同名文件（与旧系统行为一致）
    const putPolicy = new qiniu.rs.PutPolicy({ scope: `${APP_CONFIG.qiniu.bucket}:${key}` })
    const uploadToken = putPolicy.uploadToken(this.mac)

    return new Promise((resolve, reject) => {
      this.uploader.put(
        uploadToken,
        key,
        buffer,
        new qiniu.form_up.PutExtra(),
        (error, body, info) => {
          if (error || info?.statusCode !== 200) {
            this.logger.error(`Qiniu upload failed: ${error?.message ?? info?.statusCode}`)
            reject(new UploadFailedException())
            return
          }
          resolve(`${APP_CONFIG.qiniu.siteDomain}${body.key}`)
        },
      )
    })
  }
}
