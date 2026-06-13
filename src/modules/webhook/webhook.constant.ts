/**
 * 与外部 AI 知识库服务（surmon.me.ai）约定的 Webhook 事件，
 * 取值需与 AI 服务侧 src/webhook/index.ts 的 WebhookEvent 完全一致。
 */
export enum WebhookEvent {
  /** 新增/更新文章（payload 为文章对象或数组） */
  UpsertArticles = 'upsert_articles',
  /** 删除文章（payload 为文章 id 或 id 数组） */
  DeleteArticles = 'delete_articles',
  /** 更新站点 / 作者信息（payload 为 options 对象） */
  UpsertOptions = 'upsert_options',
}

/** 发送给 AI 服务的文章结构（对齐 NodePress article 模型） */
export interface WebhookArticlePayload {
  id: number
  title: string
  summary: string
  keywords: string[]
  content: string
  thumbnail: string
  origin: string
  lang: string
  featured: boolean
  disabled_comments: boolean
  tags: Array<{ name: string; slug: string }>
  categories: Array<{ name: string; slug: string }>
  stats: { likes: number; views: number; comments: number }
  extras: Array<{ key: string; value: string }>
  created_at: string
  updated_at: string
}

/** 发送给 AI 服务的站点/作者信息结构（对齐 NodePress options 模型） */
export interface WebhookOptionsPayload {
  title: string
  sub_title: string
  description: string
  keywords: string[]
  site_url: string
  site_email: string
  statement: string
  friend_links: Array<{ name: string; url: string }>
  /** JSON 字符串，AI 服务从中解析 ABOUT_BIOGRAPHY_ZH/EN 作为作者简介 */
  app_config: string
}
