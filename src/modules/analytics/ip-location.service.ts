import { Injectable, Logger } from '@nestjs/common'
import libQQWry = require('lib-qqwry')
import { CacheService } from '@/core/cache/cache.service'

/**
 * IP 归属地解析结果（尽可能精确）。location 为人类可读的完整地址，前端直接展示。
 */
export interface IPLocation {
  country: string
  countryCode: string
  region: string
  city: string
  isp: string
  /** 拼接好的最精确地址，如「江苏省南京市玄武区」「美国加利福尼亚州圣克拉拉县山景市」 */
  location: string
}

/** 单一上游归一化结果（place 为不含运营商的纯地理串） */
interface ProviderResult {
  country: string
  countryCode: string
  region: string
  city: string
  isp: string
  place: string
}

/**
 * IP 地理位置解析服务（参考 NodePress 的 IPService，多源融合 + 缓存）。
 * - 主源：纯真 IP 库（qqwry，离线、随包内置 dat）。国内 IP 常到「省市区/街道 + 运营商」级，最精细
 * - 补充：ip-api.com（中文、带 ISO 国家码，用于国旗与国家维度聚合）+ ipapi.co 兜底
 * - 取两者中更详尽的地理串作为最终 location；结果按原始 IP 在 Redis 缓存
 * - 内网/保留地址直接跳过，不外呼
 */
@Injectable()
export class IPLocationService {
  private readonly logger = new Logger(IPLocationService.name)
  /** 解析结果缓存 7 天：同一 IP 归属地短期稳定，大幅降低外呼次数 */
  private readonly cacheTtl = 60 * 60 * 24 * 7
  /** 单次外呼超时，避免上游抖动拖慢埋点写入 */
  private readonly timeoutMs = 3000
  /** 纯真库实例（载入内存，查询为本地操作） */
  private readonly qqwry = this.initQqwry()

  constructor(private readonly cache: CacheService) {}

  async resolve(ip: string): Promise<IPLocation | null> {
    if (!ip || this.isPrivateIp(ip)) return null

    const cacheKey = `analytics:iploc:${ip}`
    const cached = await this.cache.get<IPLocation | { __miss: true }>(cacheKey)
    if (cached) return '__miss' in cached ? null : cached

    // 纯真库本地查询（主源）；ip-api 在线补充国家码（兜底 ipapi.co）
    const qq = this.searchQqwry(ip)
    const api =
      (await this.queryByIpApi(ip).catch(() => null)) ??
      (await this.queryByIpapiCo(ip).catch(() => null))

    const location = qq || api ? this.merge(qq, api) : null

    if (location) {
      await this.cache.set(cacheKey, location, this.cacheTtl)
    } else {
      // 未命中用短 TTL，避免对坏 IP 反复外呼
      await this.cache.set(cacheKey, { __miss: true }, 60 * 30)
    }
    return location
  }

  /** 融合纯真库与 ip-api：地理串取更详尽者，国家码取 ip-api */
  private merge(qq: { place: string; isp: string } | null, api: ProviderResult | null): IPLocation {
    const place = this.pickRicher(qq?.place, api?.place)
    const isp = qq?.isp || api?.isp || ''
    // ip-api 缺失时（如被限流）用纯真库地理串补出国家码，至少保证中国 IP 有国旗
    const guessedCn = /中国|省|市|自治区|特别行政区/.test(qq?.place ?? '')
    return {
      country: api?.country || (guessedCn ? '中国' : ''),
      countryCode: api?.countryCode || (guessedCn ? 'CN' : ''),
      region: api?.region || '',
      city: api?.city || '',
      isp,
      location: place || '未知',
    }
  }

  /** 取信息更丰富（更长）的地理串 */
  private pickRicher(a?: string, b?: string): string {
    const x = (a ?? '').trim()
    const y = (b ?? '').trim()
    if (!x) return y
    if (!y) return x
    return x.length >= y.length ? x : y
  }

  private initQqwry(): ReturnType<typeof libQQWry> | null {
    try {
      return libQQWry(true)
    } catch (error) {
      this.logger.warn(`纯真 IP 库加载失败，降级为在线解析：${(error as Error).message}`)
      return null
    }
  }

  /** 纯真库查询：Country 为地理串，Area 为运营商/机房 */
  private searchQqwry(ip: string): { place: string; isp: string } | null {
    if (!this.qqwry) return null
    try {
      const res = this.qqwry.searchIP(ip)
      const place = this.cleanQqwry(res?.Country)
      const isp = this.cleanQqwry(res?.Area)
      if (!place && !isp) return null
      // 纯真库对未知 IP 返回的占位文案，视为无效
      if (/未知|保留|IANA|内网|局域网/.test(place)) return null
      return { place, isp }
    } catch {
      return null
    }
  }

  /** 清洗纯真库字段：去掉 CZ88.NET / 纯真网络 等占位与多余空白 */
  private cleanQqwry(value?: string): string {
    return (value ?? '')
      .replace(/CZ88\.?NET/gi, '')
      .replace(/纯真网络/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /** ip-api.com：中文地名 + ISO 国家码 + 区县 */
  private async queryByIpApi(ip: string): Promise<ProviderResult> {
    const fields = 'status,message,country,countryCode,regionName,city,district'
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN&fields=${fields}`
    const data = await this.fetchJson(url)
    if (data?.status !== 'success') throw new Error(data?.message || 'ip-api failed')
    return this.normalize({
      country: data.country,
      countryCode: data.countryCode,
      region: data.regionName,
      city: data.city,
      district: data.district,
      isp: '',
    })
  }

  /** ipapi.co：HTTPS 兜底 */
  private async queryByIpapiCo(ip: string): Promise<ProviderResult> {
    const data = await this.fetchJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`)
    if (data?.error) throw new Error(data?.reason || 'ipapi.co failed')
    return this.normalize({
      country: data.country_name,
      countryCode: data.country_code,
      region: data.region,
      city: data.city,
      district: '',
      isp: data.org,
    })
  }

  private async fetchJson(url: string): Promise<any> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'andy-blog-analytics/1.0' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } finally {
      clearTimeout(timer)
    }
  }

  /** 统一字段、拼接地理串（去重相邻重复，如直辖市的省=市） */
  private normalize(raw: {
    country?: string
    countryCode?: string
    region?: string
    city?: string
    district?: string
    isp?: string
  }): ProviderResult {
    const clean = (v?: string) => (v ?? '').trim()
    const parts: string[] = []
    for (const part of [clean(raw.country), clean(raw.region), clean(raw.city), clean(raw.district)]) {
      if (part && parts[parts.length - 1] !== part) parts.push(part)
    }
    return {
      country: clean(raw.country),
      countryCode: clean(raw.countryCode),
      region: clean(raw.region),
      city: clean(raw.city),
      isp: clean(raw.isp),
      place: parts.join(' '),
    }
  }

  /** 内网 / 回环 / 保留地址判定：这些 IP 外呼无意义 */
  private isPrivateIp(ip: string): boolean {
    const value = ip.trim().toLowerCase()
    if (!value || value === 'unknown' || value === 'localhost') return true
    if (value === '::1' || value.startsWith('fe80') || value.startsWith('fc') || value.startsWith('fd')) {
      return true
    }
    const v4 = value.includes('.') ? value.split(':').pop()! : value
    if (/^127\./.test(v4) || /^10\./.test(v4) || /^192\.168\./.test(v4)) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v4)) return true
    if (/^169\.254\./.test(v4)) return true
    return false
  }
}
