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
    /** 空库启动时自动创建的超管账号（仅 authors 集合为空时生效，幂等） */
    initAdmin: {
      name: env.ADMIN_INIT_NAME || 'admin',
      password: env.ADMIN_INIT_PASSWORD || 'admin123456',
    },
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

  /** 站点信息：用于 AI 知识库的站点/作者上下文与文章 URL 生成 */
  site: {
    name: env.SITE_NAME || '博客',
    /** 对外可访问的前台地址（用于生成文章 URL，不带末尾斜杠） */
    url: (env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
    description: env.SITE_DESCRIPTION || '',
    keywords: (env.SITE_KEYWORDS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  },

  /**
   * 自建访客统计（后台看板「访客统计」图），数据落在已有 MongoDB，无外部依赖。
   * 采集：前台路由切换上报 PV；读取：按天聚合 PV/UV。访客指纹以 auth.jwtSecret 加盐。
   */
  analytics: {
    /** 看板读数缓存秒数，降低按天聚合的查询频率 */
    cacheTtl: Number(env.ANALYTICS_CACHE_TTL) || 300,
  },

  /**
   * 内容变更 Webhook：文章/站点信息变动时通知外部 AI 知识库服务（surmon.me.ai）。
   * 采用 HMAC-SHA256 签名 + 时间戳防重放，与 NodePress 的 webhook 协议一致。
   */
  webhook: {
    /** 完整接收地址（如 https://andy-blog-ai.<account>.workers.dev/webhook）；为空则禁用 */
    endpoint: env.WEBHOOK_ENDPOINT || '',
    /** 签名密钥，必须与 AI 服务侧 WEBHOOK_SECRET 完全一致 */
    secret: env.WEBHOOK_SECRET || '',
    /** 请求超时（毫秒） */
    timeoutMs: Number(env.WEBHOOK_TIMEOUT_MS) || 8000,
  },
}
