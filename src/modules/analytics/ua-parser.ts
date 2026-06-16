/**
 * 轻量 User-Agent 解析（无外部依赖，覆盖主流浏览器/系统/设备）。
 * 用于访客明细的「设备」展示，非精确指纹，够用即可。
 */
export interface UAInfo {
  browser: string
  os: string
  /** Desktop / Mobile / Tablet / Bot */
  device: string
}

export function parseUA(ua: string): UAInfo {
  const s = ua || ''
  if (!s) return { browser: '未知', os: '未知', device: '未知' }

  // 爬虫 / 机器人
  if (/bot|spider|crawler|spdier|slurp|bingpreview|facebookexternalhit|headless/i.test(s)) {
    const m = s.match(/([a-z]+bot|[a-z]+spider|googlebot|bingbot|baiduspider|yandexbot)/i)
    return { browser: m ? m[1] : 'Bot', os: '—', device: 'Bot' }
  }

  // 操作系统
  let os = '未知'
  let m: RegExpMatchArray | null
  if (/Windows NT 10/.test(s)) os = 'Windows 10/11'
  else if (/Windows NT 6\.3/.test(s)) os = 'Windows 8.1'
  else if (/Windows NT 6\.1/.test(s)) os = 'Windows 7'
  else if (/Windows/.test(s)) os = 'Windows'
  else if (/iPhone|iPad|iPod/.test(s)) {
    m = s.match(/OS (\d+[_.]\d+)/)
    os = 'iOS' + (m ? ` ${m[1].replace(/_/g, '.')}` : '')
  } else if (/Mac OS X/.test(s)) {
    m = s.match(/Mac OS X (\d+[_.]\d+)/)
    os = 'macOS' + (m ? ` ${m[1].replace(/_/g, '.')}` : '')
  } else if (/Android/.test(s)) {
    m = s.match(/Android (\d+(?:\.\d+)?)/)
    os = 'Android' + (m ? ` ${m[1]}` : '')
  } else if (/HarmonyOS/.test(s)) os = 'HarmonyOS'
  else if (/Linux/.test(s)) os = 'Linux'

  // 浏览器（顺序敏感：内核套壳浏览器需在 Chrome/Safari 之前判断）
  let browser = '未知'
  if (/MicroMessenger/.test(s)) {
    m = s.match(/MicroMessenger\/(\d+)/)
    browser = '微信' + (m ? ` ${m[1]}` : '')
  } else if (/QQ\/|QQBrowser/.test(s)) {
    browser = /QQBrowser/.test(s) ? 'QQ浏览器' : 'QQ'
  } else if (/UCBrowser|UBrowser/.test(s)) browser = 'UC浏览器'
  else if ((m = s.match(/Edg(?:e|A|iOS)?\/(\d+)/))) browser = `Edge ${m[1]}`
  else if ((m = s.match(/(?:OPR|Opera)\/(\d+)/))) browser = `Opera ${m[1]}`
  else if ((m = s.match(/Firefox\/(\d+)/))) browser = `Firefox ${m[1]}`
  else if (/Chrome\//.test(s)) {
    m = s.match(/Chrome\/(\d+)/)
    browser = `Chrome ${m ? m[1] : ''}`.trim()
  } else if (/Safari/.test(s)) {
    m = s.match(/Version\/(\d+)/)
    browser = 'Safari' + (m ? ` ${m[1]}` : '')
  }

  // 设备类型
  let device = 'Desktop'
  if (/iPad|Tablet|PlayBook/.test(s)) device = 'Tablet'
  else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/.test(s)) device = 'Mobile'

  return { browser, os, device }
}
