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

  qiniu: {
    accessKey: env.QN_ACCESSKEY || '',
    secretKey: env.QN_SECRETKEY || '',
    bucket: env.QN_BUCKET || 'cdn-fxq-design',
    siteDomain: env.QN_SITE_DOMAIN || 'https://resources.jiawen.live/',
    keyPrefix: 'blog/',
  },

  upload: {
    /** 单文件大小上限 2MB */
    singleLimit: 1024 * 1024 * 2,
    /** 单次最多上传数量 */
    maxCount: 10,
  },
}
