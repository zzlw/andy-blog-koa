/** 文章数据变更（创建/更新/删除），用于归档缓存失效 */
export const EVENT_ARTICLE_CHANGED = 'article.changed'

/** 文章创建/更新，payload 为文章实体（lean），用于 AI 知识库 Webhook 同步 */
export const EVENT_ARTICLE_UPSERTED = 'article.upserted'

/** 文章删除，payload 为文章数字 id，用于 AI 知识库 Webhook 同步 */
export const EVENT_ARTICLE_DELETED = 'article.deleted'
