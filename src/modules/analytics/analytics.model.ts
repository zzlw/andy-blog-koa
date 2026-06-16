import { modelOptions, prop } from '@typegoose/typegoose'

/**
 * 访客访问日志（自建轻量统计，数据落在已有 MongoDB）。
 * - 每次 PV 落一条记录；UV 由 visitorKey 在读取时去重聚合，无需写时去重
 * - created_at 设 TTL（400 天）自动过期，控制集合体积，避免无限增长
 */
@modelOptions({
  schemaOptions: {
    collection: 'visitor_logs',
    versionKey: false,
  },
})
export class VisitorLog {
  /** 访问日期 YYYY-MM-DD（东八区），按天聚合用，建索引加速 $match/$group */
  @prop({ required: true, index: true })
  day: string

  /** 访客指纹：sha256(ip + ua + day + salt)，同访客当日恒定，用于 UV 去重 */
  @prop({ required: true })
  visitorKey: string

  /** 访问路径（可选，便于后续扩展热门页面统计） */
  @prop({ maxlength: 512 })
  path?: string

  /** 落库时间；TTL 400 天后自动清理（Mongo 后台 TTL 监控线程删除） */
  @prop({ default: () => new Date(), expires: 60 * 60 * 24 * 400 })
  created_at: Date
}
