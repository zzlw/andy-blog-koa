import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { Injectable, Logger } from '@nestjs/common'
import { APP_CONFIG } from '@/app.config'
import { CacheService } from '@/core/cache/cache.service'
import { AnalyticsRange, RANGE_DAYS } from './analytics.dto'

/** 单日访客指标：pv = 页面浏览量，uv = 活跃用户数 */
export interface VisitorPoint {
  date: string
  pv: number
  uv: number
}

export interface VisitorStats {
  /** 是否已正确配置 GA4（Property ID + 凭证）。未配置时前端展示引导而非错误 */
  configured: boolean
  range: AnalyticsRange
  series: VisitorPoint[]
  totals: { pv: number; uv: number }
}

/**
 * Google Analytics 4 访客统计服务。
 * - 仅服务端持有 service account 凭证，经由本接口受鉴权代理给后台看板
 * - 结果走 Redis 缓存，避免频繁请求触发 GA Data API 配额
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name)
  private client: BetaAnalyticsDataClient | null = null
  /** 解析失败/未配置则保持 false，接口降级 */
  private clientReady = false

  constructor(private readonly cache: CacheService) {
    this.initClient()
  }

  private initClient() {
    const { ga4PropertyId, ga4Credentials } = APP_CONFIG.analytics
    if (!ga4PropertyId || !ga4Credentials) return

    try {
      const trimmed = ga4Credentials.trim()
      const json = trimmed.startsWith('{')
        ? trimmed
        : Buffer.from(trimmed, 'base64').toString('utf8')
      const creds = JSON.parse(json) as {
        client_email?: string
        private_key?: string
        project_id?: string
      }
      if (!creds.client_email || !creds.private_key) {
        this.logger.warn('GA4 凭证缺少 client_email / private_key，访客统计已降级')
        return
      }
      this.client = new BetaAnalyticsDataClient({
        projectId: creds.project_id,
        credentials: {
          client_email: creds.client_email,
          // 兼容以 \n 转义存储的私钥
          private_key: creds.private_key.replace(/\\n/g, '\n'),
        },
      })
      this.clientReady = true
      this.logger.log('GA4 访客统计已启用')
    } catch (error) {
      this.logger.error('解析 GA4 凭证失败，访客统计已降级', error as Error)
    }
  }

  async getVisitorStats(range: AnalyticsRange): Promise<VisitorStats> {
    const days = RANGE_DAYS[range]

    if (!this.clientReady || !this.client) {
      return { configured: false, range, series: [], totals: { pv: 0, uv: 0 } }
    }

    const cacheKey = `analytics:visitors:${range}`
    const cached = await this.cache.get<VisitorStats>(cacheKey)
    if (cached) return cached

    try {
      const [response] = await this.client.runReport({
        property: `properties/${APP_CONFIG.analytics.ga4PropertyId}`,
        dateRanges: [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 1000,
      })

      const byDate = new Map<string, { pv: number; uv: number }>()
      for (const row of response.rows ?? []) {
        const raw = row.dimensionValues?.[0]?.value ?? '' // YYYYMMDD
        const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
        const pv = Number(row.metricValues?.[0]?.value ?? 0)
        const uv = Number(row.metricValues?.[1]?.value ?? 0)
        byDate.set(date, { pv, uv })
      }

      const series = this.buildContiguousSeries(days, byDate)
      const totals = series.reduce(
        (acc, p) => ({ pv: acc.pv + p.pv, uv: acc.uv + p.uv }),
        { pv: 0, uv: 0 },
      )

      const result: VisitorStats = { configured: true, range, series, totals }
      await this.cache.set(cacheKey, result, APP_CONFIG.analytics.cacheTtl)
      return result
    } catch (error) {
      // 配额超限/凭证失效等：不影响看板其它模块，返回空序列并记录
      this.logger.error('调用 GA4 Data API 失败', error as Error)
      return { configured: true, range, series: [], totals: { pv: 0, uv: 0 } }
    }
  }

  /** 生成从 (今天-days+1) 到今天的连续日期序列，缺失日补 0 */
  private buildContiguousSeries(
    days: number,
    byDate: Map<string, { pv: number; uv: number }>,
  ): VisitorPoint[] {
    const series: VisitorPoint[] = []
    const today = new Date()
    for (let offset = days - 1; offset >= 0; offset--) {
      const d = new Date(today)
      d.setDate(today.getDate() - offset)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`
      const hit = byDate.get(date)
      series.push({ date, pv: hit?.pv ?? 0, uv: hit?.uv ?? 0 })
    }
    return series
  }
}
