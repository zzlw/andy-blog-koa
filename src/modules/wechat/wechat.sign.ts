import { createHash } from 'node:crypto'

/**
 * 微信 JS-SDK 签名用 URL：完整 URL（含协议、路径、查询），不含 # 及后面的锚点。
 * 签名串与前端 wx.config 传入的 URL 必须完全一致，否则 invalid signature。
 */
export const normalizeJsapiUrl = (url: string): string => url.trim().split('#')[0]

/** 字段按 ASCII 排序后拼接：jsapi_ticket / noncestr / timestamp / url */
export const createJsapiSignature = (params: {
  ticket: string
  nonceStr: string
  timestamp: number
  url: string
}): string => {
  const url = normalizeJsapiUrl(params.url)
  const signStr = `jsapi_ticket=${params.ticket}&noncestr=${params.nonceStr}&timestamp=${params.timestamp}&url=${url}`
  return createHash('sha1').update(signStr, 'utf8').digest('hex')
}
