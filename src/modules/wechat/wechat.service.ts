import { randomBytes } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import { APP_CONFIG } from '@/app.config'
import { WechatException } from '@/common/exceptions/biz.exception'
import { CacheService } from '@/core/cache/cache.service'
import { createJsapiSignature, normalizeJsapiUrl } from './wechat.sign'

const CACHE_ACCESS_TOKEN = 'wechat:access_token'
const CACHE_JSAPI_TICKET = 'wechat:jsapi_ticket'
/** 微信凭据有效 7200s，提前 200s 失效以免用到过期 ticket */
const TOKEN_TTL_MARGIN_SEC = 200
const WECHAT_FETCH_TIMEOUT_MS = 8000

interface WechatTokenResponse {
  access_token?: string
  expires_in?: number
  errcode?: number
  errmsg?: string
}

interface WechatTicketResponse {
  ticket?: string
  expires_in?: number
  errcode?: number
  errmsg?: string
}

export type WechatSignatureResult =
  | { enabled: false }
  | {
      enabled: true
      appId: string
      timestamp: number
      nonceStr: string
      signature: string
    }

@Injectable()
export class WechatService {
  private readonly logger = new Logger(WechatService.name)
  private readonly config = APP_CONFIG.wechat

  constructor(private readonly cache: CacheService) {}

  get enabled(): boolean {
    return Boolean(this.config.appId && this.config.appSecret)
  }

  async getSignature(url: string): Promise<WechatSignatureResult> {
    if (!this.enabled) return { enabled: false }

    const ticket = await this.getJsapiTicket()
    const nonceStr = randomBytes(16).toString('hex')
    const timestamp = Math.floor(Date.now() / 1000)
    const normalizedUrl = normalizeJsapiUrl(url)
    const signature = createJsapiSignature({
      ticket,
      nonceStr,
      timestamp,
      url: normalizedUrl,
    })

    return {
      enabled: true,
      appId: this.config.appId,
      timestamp,
      nonceStr,
      signature,
    }
  }

  private async getJsapiTicket(retried = false): Promise<string> {
    const cached = await this.cache.get<string>(CACHE_JSAPI_TICKET)
    if (cached) return cached

    const token = await this.getAccessToken()
    const data = await this.fetchWechatJson<WechatTicketResponse>(
      `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${encodeURIComponent(token)}&type=jsapi`,
    )

    if (data.errcode && data.errcode !== 0) {
      // 40001：access_token 无效/过期，清缓存后重试一次
      if (!retried && data.errcode === 40001) {
        await this.cache.delete(CACHE_ACCESS_TOKEN)
        await this.cache.delete(CACHE_JSAPI_TICKET)
        return this.getJsapiTicket(true)
      }
      throw new WechatException(data.errmsg || `获取 jsapi_ticket 失败（${data.errcode}）`)
    }
    if (!data.ticket) throw new WechatException('获取 jsapi_ticket 失败：响应无 ticket')

    await this.cache.set(CACHE_JSAPI_TICKET, data.ticket, this.cacheTtl(data.expires_in))
    return data.ticket
  }

  private async getAccessToken(): Promise<string> {
    const cached = await this.cache.get<string>(CACHE_ACCESS_TOKEN)
    if (cached) return cached

    const { appId, appSecret } = this.config
    const data = await this.fetchWechatJson<WechatTokenResponse>(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`,
    )

    if (data.errcode && data.errcode !== 0) {
      throw new WechatException(data.errmsg || `获取 access_token 失败（${data.errcode}）`)
    }
    if (!data.access_token) throw new WechatException('获取 access_token 失败：响应无 token')

    await this.cache.set(CACHE_ACCESS_TOKEN, data.access_token, this.cacheTtl(data.expires_in))
    return data.access_token
  }

  private cacheTtl(expiresIn?: number): number {
    const ttl = (expiresIn ?? 7200) - TOKEN_TTL_MARGIN_SEC
    return Math.max(60, ttl)
  }

  private async fetchWechatJson<T>(url: string): Promise<T> {
    let response: Response
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(WECHAT_FETCH_TIMEOUT_MS) })
    } catch (error) {
      this.logger.error('请求微信 API 失败', error as Error)
      throw new WechatException('请求微信 API 超时或网络异常')
    }
    if (!response.ok) {
      throw new WechatException(`微信 API HTTP ${response.status}`)
    }
    return (await response.json()) as T
  }
}
