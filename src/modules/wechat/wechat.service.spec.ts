import { WechatException } from '@/common/exceptions/biz.exception'
import { WechatService } from './wechat.service'

jest.mock('@/app.config', () => ({
  APP_CONFIG: {
    wechat: { appId: 'wxTEST', appSecret: 'secretTEST' },
  },
}))

import { APP_CONFIG } from '@/app.config'

describe('WechatService', () => {
  let cache: { get: jest.Mock; set: jest.Mock; delete: jest.Mock }
  let service: WechatService
  const originalFetch = global.fetch

  beforeEach(() => {
    APP_CONFIG.wechat.appId = 'wxTEST'
    APP_CONFIG.wechat.appSecret = 'secretTEST'
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    }
    service = new WechatService(cache as any)
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('未配置 AppID 时返回 enabled:false，不请求微信', async () => {
    APP_CONFIG.wechat.appId = ''
    const result = await service.getSignature('https://jiawen.live/')
    expect(result).toEqual({ enabled: false })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('命中 ticket 缓存时直接签名，不打微信接口', async () => {
    cache.get.mockImplementation(async (key: string) =>
      key === 'wechat:jsapi_ticket' ? 'cached-ticket' : null,
    )
    const result = await service.getSignature('https://jiawen.live/article/1#comments')
    expect(result.enabled).toBe(true)
    if (result.enabled) {
      expect(result.appId).toBe('wxTEST')
      expect(result.nonceStr).toHaveLength(32)
      expect(result.signature).toMatch(/^[a-f0-9]{40}$/)
    }
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('缓存未命中时拉取 token + ticket 并写入 Redis', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errcode: 0, ticket: 'tik', expires_in: 7200 }),
      })

    const result = await service.getSignature('https://jiawen.live/')
    expect(result.enabled).toBe(true)
    expect(cache.set).toHaveBeenCalledWith('wechat:access_token', 'tok', 7000)
    expect(cache.set).toHaveBeenCalledWith('wechat:jsapi_ticket', 'tik', 7000)
  })

  it('ticket 接口返回 40001 时清缓存并重试一次', async () => {
    const store: Record<string, string> = { 'wechat:access_token': 'stale-token' }
    cache.get.mockImplementation(async (key: string) => store[key] ?? null)
    cache.delete.mockImplementation(async (key: string) => {
      delete store[key]
    })
    cache.set.mockImplementation(async (key: string, value: string) => {
      store[key] = value
    })
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errcode: 40001, errmsg: 'invalid credential' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'fresh-token', expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errcode: 0, ticket: 'fresh-ticket', expires_in: 7200 }),
      })

    const result = await service.getSignature('https://jiawen.live/')
    expect(result.enabled).toBe(true)
    expect(cache.delete).toHaveBeenCalledWith('wechat:access_token')
    expect(cache.delete).toHaveBeenCalledWith('wechat:jsapi_ticket')
  })

  it('微信 API 业务错误抛出 WechatException', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errcode: 40013, errmsg: 'invalid appid' }),
    })
    await expect(service.getSignature('https://jiawen.live/')).rejects.toThrow(WechatException)
  })
})
