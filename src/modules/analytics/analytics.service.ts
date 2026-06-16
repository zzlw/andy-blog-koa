import { createHash } from 'node:crypto'
import { Model } from 'mongoose'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@/core/database/model.transformer'
import { APP_CONFIG } from '@/app.config'
import { CacheService } from '@/core/cache/cache.service'
import { AnalyticsRange, RANGE_DAYS } from './analytics.dto'
import { VisitorLog } from './analytics.model'
import { IPLocationService } from './ip-location.service'

/** 单日访客指标：pv = 页面浏览量，uv = 独立访客数 */
export interface VisitorPoint {
  date: string
  pv: number
  uv: number
}

export interface VisitorStats {
  /** 自建统计恒为 true（无外部依赖），保留字段以兼容前端组件 */
  configured: boolean
  range: AnalyticsRange
  series: VisitorPoint[]
  totals: { pv: number; uv: number }
}

/** 维度聚合项（地区 / 国家 / 页面）：pv 浏览量、uv 独立访客 */
export interface DimensionStat {
  key: string
  pv: number
  uv: number
}

/** 最近访客明细（不含原始 IP，仅展示归属地） */
export interface RecentVisitor {
  time: Date
  location: string
  country: string
  country_code: string
  isp: string
  path: string
}

/** 访客分析页所需的多维洞察 */
export interface VisitorInsights {
  range: AnalyticsRange
  totals: { pv: number; uv: number }
  topLocations: DimensionStat[]
  topCountries: DimensionStat[]
  topPages: DimensionStat[]
  recent: RecentVisitor[]
}

/** 东八区偏移：按 Asia/Shanghai 切分自然日，不依赖运行环境 TZ */
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 访客统计服务（自建，数据源：MongoDB）。
 * - 采集：前台每次路由切换上报一条 PV 记录，服务端解析 IP/UA 生成访客指纹
 * - 读取：按天聚合 PV（计数）与 UV（visitorKey 去重），结果走 Redis 缓存
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name)

  constructor(
    @InjectModel(VisitorLog) private readonly visitorLogModel: Model<VisitorLog>,
    private readonly cache: CacheService,
    private readonly ipLocation: IPLocationService,
  ) {}

  /** 记录一次访问（PV）；解析归属地并落库，访客指纹用于读取时的 UV 去重 */
  async collect(input: { ip: string; ua: string; path?: string }): Promise<void> {
    const day = this.dayString(Date.now())
    const visitorKey = createHash('sha256')
      .update(`${input.ip}|${input.ua}|${day}|${APP_CONFIG.auth.jwtSecret}`)
      .digest('hex')
    try {
      // 归属地解析带缓存与超时，失败不阻断埋点写入
      const geo = await this.ipLocation.resolve(input.ip).catch(() => null)
      await this.visitorLogModel.create({
        day,
        visitorKey,
        path: input.path?.slice(0, 512),
        location: geo?.location,
        country: geo?.country,
        country_code: geo?.countryCode,
        region: geo?.region,
        city: geo?.city,
        isp: geo?.isp,
      })
    } catch (error) {
      // 埋点失败不应影响前台体验，仅记录
      this.logger.warn(`访客埋点写入失败：${(error as Error).message}`)
    }
  }

  async getVisitorStats(range: AnalyticsRange): Promise<VisitorStats> {
    const ttl = APP_CONFIG.analytics.cacheTtl
    const cacheKey = `analytics:visitors:${range}`
    if (ttl > 0) {
      const cached = await this.cache.get<VisitorStats>(cacheKey)
      if (cached) return cached
    }

    const days = RANGE_DAYS[range]
    const startDay = this.dayString(Date.now() - (days - 1) * DAY_MS)

    const rows = await this.visitorLogModel
      .aggregate<{ day: string; pv: number; uv: number }>([
        { $match: { day: { $gte: startDay } } },
        { $group: { _id: '$day', pv: { $sum: 1 }, visitors: { $addToSet: '$visitorKey' } } },
        { $project: { _id: 0, day: '$_id', pv: 1, uv: { $size: '$visitors' } } },
      ])
      .exec()

    const byDate = new Map(rows.map((r) => [r.day, { pv: r.pv, uv: r.uv }]))
    const series = this.buildContiguousSeries(days, byDate)
    const totals = series.reduce(
      (acc, p) => ({ pv: acc.pv + p.pv, uv: acc.uv + p.uv }),
      { pv: 0, uv: 0 },
    )

    const result: VisitorStats = { configured: true, range, series, totals }
    if (ttl > 0) await this.cache.set(cacheKey, result, ttl)
    return result
  }

  /** 访客分析：地区 / 国家 / 页面的 Top 维度聚合 + 最近访客明细 */
  async getInsights(range: AnalyticsRange): Promise<VisitorInsights> {
    const ttl = APP_CONFIG.analytics.cacheTtl
    const cacheKey = `analytics:insights:${range}`
    if (ttl > 0) {
      const cached = await this.cache.get<VisitorInsights>(cacheKey)
      if (cached) return cached
    }

    const days = RANGE_DAYS[range]
    const startDay = this.dayString(Date.now() - (days - 1) * DAY_MS)
    const match = { day: { $gte: startDay } }

    const [topLocations, topCountries, topPages, recentRows, totalsRow] = await Promise.all([
      this.aggregateDimension(match, '$location', 20),
      this.aggregateDimension(match, '$country', 12),
      this.aggregateDimension(match, '$path', 20),
      this.visitorLogModel
        .find(match, { _id: 0, created_at: 1, location: 1, country: 1, country_code: 1, isp: 1, path: 1 })
        .sort({ created_at: -1 })
        .limit(50)
        .lean()
        .exec(),
      this.visitorLogModel
        .aggregate<{ pv: number; uv: number }>([
          { $match: match },
          { $group: { _id: null, pv: { $sum: 1 }, visitors: { $addToSet: '$visitorKey' } } },
          { $project: { _id: 0, pv: 1, uv: { $size: '$visitors' } } },
        ])
        .exec(),
    ])

    const result: VisitorInsights = {
      range,
      totals: totalsRow[0] ?? { pv: 0, uv: 0 },
      topLocations,
      topCountries,
      topPages,
      recent: recentRows.map((r) => ({
        time: r.created_at,
        location: r.location || '未知',
        country: r.country || '',
        country_code: r.country_code || '',
        isp: r.isp || '',
        path: r.path || '',
      })),
    }
    if (ttl > 0) await this.cache.set(cacheKey, result, ttl)
    return result
  }

  /** 按某字段聚合 PV/UV 的 Top N（忽略空值字段） */
  private aggregateDimension(
    match: Record<string, unknown>,
    field: string,
    limit: number,
  ): Promise<DimensionStat[]> {
    return this.visitorLogModel
      .aggregate<DimensionStat>([
        { $match: { ...match, [field.slice(1)]: { $nin: [null, ''] } } },
        { $group: { _id: field, pv: { $sum: 1 }, visitors: { $addToSet: '$visitorKey' } } },
        { $project: { _id: 0, key: '$_id', pv: 1, uv: { $size: '$visitors' } } },
        { $sort: { pv: -1 } },
        { $limit: limit },
      ])
      .exec()
  }

  /** 毫秒时间戳按东八区换算为 YYYY-MM-DD */
  private dayString(ms: number): string {
    return new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10)
  }

  /** 生成从 (今天-days+1) 到今天的连续日期序列，缺失日补 0 */
  private buildContiguousSeries(
    days: number,
    byDate: Map<string, { pv: number; uv: number }>,
  ): VisitorPoint[] {
    const series: VisitorPoint[] = []
    const now = Date.now()
    for (let offset = days - 1; offset >= 0; offset--) {
      const date = this.dayString(now - offset * DAY_MS)
      const hit = byDate.get(date)
      series.push({ date, pv: hit?.pv ?? 0, uv: hit?.uv ?? 0 })
    }
    return series
  }
}
