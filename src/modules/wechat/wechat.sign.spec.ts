import { createJsapiSignature, normalizeJsapiUrl } from './wechat.sign'

describe('wechat.sign', () => {
  it('去掉 # 及其后的锚点，保留 query', () => {
    expect(normalizeJsapiUrl('https://jiawen.live/article/1?from=timeline#comments')).toBe(
      'https://jiawen.live/article/1?from=timeline',
    )
  })

  it('与微信官方文档示例签名一致', () => {
    // https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/JS-SDK.html#62
    const signature = createJsapiSignature({
      ticket: 'sM4AOVdWfPE4DxkXGEs8VMCPGGVi4C3VM0P37wVUCFvkVAy_90u5h9nbSlYy3-Sl-HhTdfl2fzFy1AOcHKP7qg',
      nonceStr: 'Wm3WZYTPz0wzccnW',
      timestamp: 1414587457,
      url: 'http://mp.weixin.qq.com?params=value',
    })
    expect(signature).toBe('0f9de62fce790f9a083d5c99e95740ceb90c27ed')
  })

  it('签名前会规范化 URL（忽略 hash）', () => {
    const base = {
      ticket: 'sM4AOVdWfPE4DxkXGEs8VMCPGGVi4C3VM0P37wVUCFvkVAy_90u5h9nbSlYy3-Sl-HhTdfl2fzFy1AOcHKP7qg',
      nonceStr: 'Wm3WZYTPz0wzccnW',
      timestamp: 1414587457,
    }
    const withHash = createJsapiSignature({ ...base, url: 'http://mp.weixin.qq.com?params=value#/foo' })
    const withoutHash = createJsapiSignature({ ...base, url: 'http://mp.weixin.qq.com?params=value' })
    expect(withHash).toBe(withoutHash)
  })
})
