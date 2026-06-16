import { Injectable, Logger } from '@nestjs/common'
import { CacheService } from '@/core/cache/cache.service'

/**
 * IP 归属地解析结果（尽可能精确：洲/国/省/市/区县/邮编/经纬度/运营商）。
 * location 为拼好的人类可读完整地址（中文优先），前端直接展示。
 */
export interface IPLocation {
  country: string
  countryCode: string
  region: string
  city: string
  /** 区/县（ip-api 提供，进一步提高精度，可能为空） */
  district: string
  zip: string
  isp: string
  lat: number | null
  lon: number | null
  /** 拼接好的完整地址，如「中国 浙江省 杭州市 西湖区 · 电信」 */
  location: string
}

/**
 * IP 地理位置解析服务（参考 NodePress 的 IPService 实现，多上游降级 + 缓存）。
 * - 上游 1：ip-api.com（免费、无需 key、支持 lang=zh-CN 中文地名、字段最详尽）
 * - 上游 2：ipapi.co（HTTPS 兜底）
 * - 结果按原始 IP 在 Redis 缓存，规避免费额度限频（ip-api 约 45 次/分钟）
 * - 内网/保留地址直接跳过，不外呼
 */
@Injectable()
export class IPLocationService {
  private readonly logger = new Logger(IPLocationService.name)
  /** 解析结果缓存 7 天：同一 IP 归属地短期稳定，大幅降低外呼次数 */
  private readonly cacheTtl = 60 * 60 * 24 * 7
  /** 单次外呼超时，避免上游抖动拖慢埋点写入 */
  private readonly timeoutMs = 3000

  constructor(private readonly cache: CacheService) {}

  async resolve(ip: string): Promise<IPLocation | null> {
    if (!ip || this.isPrivateIp(ip)) return null

    const cacheKey = `analytics:iploc:${ip}`
    const cached = await this.cache.get<IPLocation | { __miss: true }>(cacheKey)
    if (cached) return '__miss' in cached ? null : cached

    const location =
      (await this.queryByIpApi(ip).catch(() => null)) ??
      (await this.queryByIpapiCo(ip).catch(() => null))

    // 命中与未命中都缓存：未命中用短得多的 TTL，避免对坏 IP 反复外呼
    if (location) {
      await this.cache.set(cacheKey, location, this.cacheTtl)
    } else {
      await this.cache.set(cacheKey, { __miss: true }, 60 * 30)
    }
    return location
  }

  /** ip-api.com：中文地名 + 详尽字段（含区县/邮编/经纬度/运营商） */
  private async queryByIpApi(ip: string): Promise<IPLocation> {
    const fields = 'status,message,country,countryCode,regionName,city,district,zip,lat,lon,isp'
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN&fields=${fields}`
    const data = await this.fetchJson(url)
    if (data?.status !== 'success') {
      throw new Error(data?.message || 'ip-api failed')
    }
    return this.normalize({
      country: data.country,
      countryCode: data.countryCode,
      region: data.regionName,
      city: data.city,
      district: data.district,
      zip: data.zip,
      isp: data.isp,
      lat: data.lat,
      lon: data.lon,
    })
  }

  /** ipapi.co：HTTPS 兜底 */
  private async queryByIpapiCo(ip: string): Promise<IPLocation> {
    const data = await this.fetchJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`)
    if (data?.error) {
      throw new Error(data?.reason || 'ipapi.co failed')
    }
    return this.normalize({
      country: data.country_name,
      countryCode: data.country_code,
      region: data.region,
      city: data.city,
      district: '',
      zip: data.postal,
      isp: data.org,
      lat: data.latitude,
      lon: data.longitude,
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

  /** 统一字段、拼接完整地址（去重相邻重复，如直辖市的省=市） */
  private normalize(raw: {
    country?: string
    countryCode?: string
    region?: string
    city?: string
    district?: string
    zip?: string
    isp?: string
    lat?: number
    lon?: number
  }): IPLocation {
    const clean = (v?: string) => (v ?? '').trim()
    const parts: string[] = []
    for (const part of [clean(raw.country), clean(raw.region), clean(raw.city), clean(raw.district)]) {
      if (part && parts[parts.length - 1] !== part) parts.push(part)
    }
    const place = parts.join(' ')
    const isp = clean(raw.isp)
    const location = isp ? `${place} · ${isp}` : place

    return {
      country: clean(raw.country),
      countryCode: clean(raw.countryCode),
      region: clean(raw.region),
      city: clean(raw.city),
      district: clean(raw.district),
      zip: clean(raw.zip),
      isp,
      lat: typeof raw.lat === 'number' ? raw.lat : null,
      lon: typeof raw.lon === 'number' ? raw.lon : null,
      location: location || '未知',
    }
  }

  /** 内网 / 回环 / 保留地址判定：这些 IP 外呼无意义 */
  private isPrivateIp(ip: string): boolean {
    const value = ip.trim().toLowerCase()
    if (!value || value === 'unknown' || value === 'localhost') return true
    if (value === '::1' || value.startsWith('fe80') || value.startsWith('fc') || value.startsWith('fd')) {
      return true
    }
    // IPv4-mapped IPv6（::ffff:127.0.0.1）取末段判断
    const v4 = value.includes('.') ? value.split(':').pop()! : value
    if (/^127\./.test(v4) || /^10\./.test(v4) || /^192\.168\./.test(v4)) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v4)) return true
    if (/^169\.254\./.test(v4)) return true
    return false
  }
}
