import { Injectable, Logger } from '@nestjs/common'
import { APP_CONFIG } from '@/app.config'
import { CacheService } from '@/core/cache/cache.service'
import { AnalyticsRange, RANGE_DAYS } from './analytics.dto'

/** 单日访客指标：pv = 页面浏览量，uv = 独立访客（Umami session 数） */
export interface VisitorPoint {
  date: string
  pv: number
  uv: number
}

export interface VisitorStats {
  /** 是否已正确配置 Umami（地址 + 网站 ID + 账号）。未配置时前端展示引导而非错误 */
  configured: boolean
  range: AnalyticsRange
  series: VisitorPoint[]
  totals: { pv: number; uv: number }
}

/** Umami pageviews 接口返回结构：x 为时区化后的时间串，y 为计数 */
interface UmamiPageviews {
  pageviews: { x: string; y: number }[]
  sessions: { x: string; y: number }[]
}

/** 看板时区：与服务器 TZ 一致，保证按「自然日」聚合 */
const TIMEZONE = 'Asia/Shanghai'

/**
 * 访客统计服务（数据源：自托管 Umami）。
 * - 采集端与读数端均在自有服务器，规避海外 API 不可达问题
 * - 经内网调用 Umami REST API（登录拿 token → 拉 pageviews 时间序列）
 * - 结果走 Redis 缓存，降低对 Umami 的请求频率
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name)
  /** 缓存的 Umami 访问令牌，401 时清空并重新登录 */
  private token: string | null = null
  /** 配置齐全才启用，否则接口降级返回 configured=false */
  private readonly enabled: boolean

  constructor(private readonly cache: CacheService) {
    const { apiUrl, websiteId, username, password } = APP_CONFIG.analytics
    this.enabled = Boolean(apiUrl && websiteId && username && password)
    if (this.enabled) {
      this.logger.log('Umami 访客统计已启用')
    }
  }

  async getVisitorStats(range: AnalyticsRange): Promise<VisitorStats> {
    if (!this.enabled) {
      return { configured: false, range, series: [], totals: { pv: 0, uv: 0 } }
    }

    const cacheKey = `analytics:visitors:${range}`
    const cached = await this.cache.get<VisitorStats>(cacheKey)
    if (cached) return cached

    const days = RANGE_DAYS[range]

    try {
      const data = await this.fetchPageviews(days)
      const byDate = this.aggregateByDate(data)
      const series = this.buildContiguousSeries(days, byDate)
      const totals = series.reduce(
        (acc, p) => ({ pv: acc.pv + p.pv, uv: acc.uv + p.uv }),
        { pv: 0, uv: 0 },
      )

      const result: VisitorStats = { configured: true, range, series, totals }
      await this.cache.set(cacheKey, result, APP_CONFIG.analytics.cacheTtl)
      return result
    } catch (error) {
      // Umami 不可达/凭证失效等：不影响看板其它模块，返回空序列并记录
      this.logger.error('调用 Umami API 失败', error as Error)
      return { configured: true, range, series: [], totals: { pv: 0, uv: 0 } }
    }
  }

  /** 拉取近 days 天的每日 PV/UV 时间序列；token 失效（401）自动重登一次 */
  private async fetchPageviews(days: number, retry = true): Promise<UmamiPageviews> {
    const { apiUrl, websiteId } = APP_CONFIG.analytics
    const token = await this.ensureToken()

    const endAt = Date.now()
    const startAt = endAt - days * 24 * 60 * 60 * 1000
    const params = new URLSearchParams({
      startAt: String(startAt),
      endAt: String(endAt),
      unit: 'day',
      timezone: TIMEZONE,
    })
    const url = `${apiUrl}/api/websites/${websiteId}/pageviews?${params.toString()}`

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401 && retry) {
      this.token = null
      return this.fetchPageviews(days, false)
    }
    if (!res.ok) {
      throw new Error(`Umami pageviews 请求失败：HTTP ${res.status}`)
    }
    return (await res.json()) as UmamiPageviews
  }

  /** 登录获取并缓存 token；缓存命中直接复用，避免每次请求都登录 */
  private async ensureToken(): Promise<string> {
    if (this.token) return this.token

    const { apiUrl, username, password } = APP_CONFIG.analytics
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      throw new Error(`Umami 登录失败：HTTP ${res.status}`)
    }
    const data = (await res.json()) as { token?: string }
    if (!data.token) {
      throw new Error('Umami 登录响应缺少 token')
    }
    this.token = data.token
    return this.token
  }

  /** 将 Umami 的 pageviews/sessions 两个序列按自然日聚合为 { date: { pv, uv } } */
  private aggregateByDate(data: UmamiPageviews): Map<string, { pv: number; uv: number }> {
    const byDate = new Map<string, { pv: number; uv: number }>()
    const accumulate = (key: 'pv' | 'uv', points: { x: string; y: number }[]) => {
      for (const point of points ?? []) {
        // x 形如 "2026-01-15 00:00:00"（已按 timezone 归一），取日期部分
        const date = point.x.slice(0, 10)
        const cur = byDate.get(date) ?? { pv: 0, uv: 0 }
        cur[key] += Number(point.y) || 0
        byDate.set(date, cur)
      }
    }
    accumulate('pv', data.pageviews)
    accumulate('uv', data.sessions)
    return byDate
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
