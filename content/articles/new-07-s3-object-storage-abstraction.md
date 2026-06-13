---
title: 把对象存储抽象成一层 S3 接口：兼容 OSS / R2 / MinIO
description: 用 AWS SDK 的 S3 协议作为统一抽象，让开发环境跑本地 MinIO、生产用阿里云 OSS、未来可换 Cloudflare R2，全靠改环境变量。还要避开 SDK 新版默认校验头踩的坑。
cover: ""
category: 后端工程
tags: [S3, 对象存储, Node.js, NestJS]
created_date: 2026-04-02
status: published
public: true
star: false
---

博客要存图片。最省心的做法不是绑死某一家云存储，而是**对着 S3 协议编程**——因为阿里云 OSS、Cloudflare R2、MinIO、AWS S3 全都兼容它。这样开发环境用本地 MinIO，生产用 OSS，将来想换 R2，只改环境变量就行。

## 一个薄封装搞定

整个对象存储就一个 service，基于 `@aws-sdk/client-s3`：

```ts
@Injectable()
export class S3Service {
  private readonly client = new S3Client({
    region: APP_CONFIG.s3.region,
    endpoint: APP_CONFIG.s3.endpoint,
    forcePathStyle: APP_CONFIG.s3.forcePathStyle,
    credentials: {
      accessKeyId: APP_CONFIG.s3.accessKeyId,
      secretAccessKey: APP_CONFIG.s3.secretAccessKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
}
```

`endpoint` 和 `forcePathStyle` 是兼容不同实现的两个关键开关：

- 开发：`endpoint=http://minio:9000`、`forcePathStyle=true`（MinIO 走 path-style）；
- 生产：`endpoint=https://oss-cn-beijing.aliyuncs.com`、`forcePathStyle=false`（OSS 走 virtual-host 风格）。

业务代码完全不知道背后是谁，换存储 = 换几个环境变量。

## 踩坑：AWS SDK 的 CRC32 校验头

这是个真实而隐蔽的坑。AWS SDK `>= 3.729` 默认会给 Put/Get 请求注入一个 `x-amz-checksum-crc32` 校验头。AWS S3 自家认，但**阿里云 OSS、R2 等兼容实现不认**，会直接拒绝请求——表现就是「上传莫名其妙失败」，还很难一眼看出原因。

解法是把校验和计算改回「仅在 API 明确要求时」才做：

```ts
// AWS SDK >= 3.729 默认给 Put/Get 注入 CRC32 校验头，
// OSS / R2 等不支持会直接拒绝请求导致上传失败
requestChecksumCalculation: 'WHEN_REQUIRED',
responseChecksumValidation: 'WHEN_REQUIRED',
```

记下来，给同样被坑的人省几小时。

## 设计取舍：只存相对路径

上传成功后，我**只返回相对路径**（如 `/blog/xxx.jpg`），不返回带域名的完整 URL：

```ts
async upload(filename: string, buffer: Buffer, contentType?: string): Promise<string> {
  const key = `${APP_CONFIG.s3.keyPrefix}${filename}`
  await this.client.send(
    new PutObjectCommand({
      Bucket: APP_CONFIG.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    }),
  )
  return `/${key}`
}
```

域名和协议由前端在渲染时用 `STATIC_PATH` 拼接。为什么这么设计？

- **换 CDN 域名 / 换协议只改环境变量**，数据库里存量的图片路径一个都不用动；
- 如果数据库里存的是完整 URL，哪天 CDN 域名变了，就得写迁移脚本批量改历史数据——存相对路径把这个风险彻底消除了。

再加一句 `CacheControl: 'public, max-age=31536000'`，图片这种不可变资源直接让浏览器/CDN 长期缓存，省带宽。

## 异常也走统一通道

上传失败时，抛的是业务异常而不是裸 error：

```ts
catch (error) {
  this.logger.error(`S3 upload failed: ${(error as Error).message}`)
  throw new UploadFailedException()
}
```

它会被全局异常过滤器接住，格式化成统一信封返回给前端，和系统里其他错误一致。

## 小结

面向 S3 协议编程，是「不被云厂商绑死」最省力的方式。一个薄 service + 两个环境变量（endpoint、forcePathStyle）就能在 MinIO / OSS / R2 之间自由切换；只存相对路径让换域名无痛；最后别忘了关掉 SDK 新版那个会被 OSS/R2 拒绝的 CRC32 校验头。
