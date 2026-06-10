// 应用配置：全部环境相关项从环境变量读取，禁止硬编码
const env = process.env

export const APP_CONFIG = {
  port: Number(env.PORT) || 3000,
  environment: env.NODE_ENV || 'development',

  mongo: {
    uri: env.MONGO_URI || 'mongodb://127.0.0.1:27017/andy_blog',
  },

  redis: {
    uri: env.REDIS_URI || 'redis://127.0.0.1:6379',
  },

  auth: {
    jwtSecret: env.JWT_SECRET || 'dev_only_insecure_secret',
    /** access token 过期时间（秒） */
    accessExpiresIn: Number(env.JWT_ACCESS_EXPIRES_IN) || 60 * 60,
    /** refresh token 过期时间（秒） */
    refreshExpiresIn: Number(env.JWT_REFRESH_EXPIRES_IN) || 60 * 60 * 24 * 30,
  },

  /** S3 兼容对象存储（AWS S3 / Cloudflare R2 / MinIO 等） */
  s3: {
    endpoint: env.S3_ENDPOINT || 'http://127.0.0.1:9000',
    region: env.S3_REGION || 'us-east-1',
    accessKeyId: env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: env.S3_SECRET_ACCESS_KEY || '',
    bucket: env.S3_BUCKET || 'andy-blog',
    /** 浏览器可达的资源基础地址（CDN 域名或 MinIO 对外地址），以 / 结尾 */
    publicUrl: env.S3_PUBLIC_URL || 'http://localhost:9000/andy-blog/',
    /** MinIO 等自建服务需要 path-style；AWS S3 可设为 false */
    forcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
    keyPrefix: 'blog/',
  },

  upload: {
    /** 单文件大小上限 2MB */
    singleLimit: 1024 * 1024 * 2,
    /** 单次最多上传数量 */
    maxCount: 10,
  },
}
