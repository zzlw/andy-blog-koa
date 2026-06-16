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

  /** 完整归属地（中文优先，如「中国 浙江省 杭州市 西湖区 · 电信」），用于地区分布与最近访客展示 */
  @prop({ maxlength: 256, index: true })
  location?: string

  /** 国家（中文，按国家聚合用） */
  @prop({ maxlength: 64 })
  country?: string

  /** ISO 国家码（如 CN/US），前端可据此显示国旗 */
  @prop({ maxlength: 8 })
  country_code?: string

  /** 省/州 */
  @prop({ maxlength: 64 })
  region?: string

  /** 城市 */
  @prop({ maxlength: 64 })
  city?: string

  /** 网络运营商 / 组织（如 中国电信、Google LLC） */
  @prop({ maxlength: 128 })
  isp?: string

  /** 原始访客 IP（仅后台管理可见；内网/解析失败可能为空） */
  @prop({ maxlength: 64 })
  ip?: string

  /** 浏览器（由 UA 解析，如 Chrome 124） */
  @prop({ maxlength: 64 })
  browser?: string

  /** 操作系统（由 UA 解析，如 Windows 10/11、iOS 17.4） */
  @prop({ maxlength: 64 })
  os?: string

  /** 设备类型：Desktop / Mobile / Tablet / Bot */
  @prop({ maxlength: 16 })
  device?: string

  /** 落库时间；TTL 400 天后自动清理（Mongo 后台 TTL 监控线程删除） */
  @prop({ default: () => new Date(), expires: 60 * 60 * 24 * 400 })
  created_at: Date
}
