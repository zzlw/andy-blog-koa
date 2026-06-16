import { createHash } from 'node:crypto'
import { Model } from 'mongoose'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@/core/database/model.transformer'
import { APP_CONFIG } from '@/app.config'
import { CacheService } from '@/core/cache/cache.service'
import { AnalyticsRange, RANGE_DAYS } from './analytics.dto'
import { VisitorLog } from './analytics.model'

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
  ) {}

  /** 记录一次访问（PV）；访客指纹用于读取时的 UV 去重 */
  async collect(input: { ip: string; ua: string; path?: string }): Promise<void> {
    const day = this.dayString(Date.now())
    const visitorKey = createHash('sha256')
      .update(`${input.ip}|${input.ua}|${day}|${APP_CONFIG.auth.jwtSecret}`)
      .digest('hex')
    try {
      await this.visitorLogModel.create({ day, visitorKey, path: input.path?.slice(0, 512) })
    } catch (error) {
      // 埋点失败不应影响前台体验，仅记录
      this.logger.warn(`访客埋点写入失败：${(error as Error).message}`)
    }
  }

  async getVisitorStats(range: AnalyticsRange): Promise<VisitorStats> {
    const cacheKey = `analytics:visitors:${range}`
    const cached = await this.cache.get<VisitorStats>(cacheKey)
    if (cached) return cached

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
    await this.cache.set(cacheKey, result, APP_CONFIG.analytics.cacheTtl)
    return result
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
