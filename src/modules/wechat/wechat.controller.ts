import { Controller, Get, Query } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { WechatService } from './wechat.service'
import { WechatSignatureQueryDTO } from './wechat.dto'

@Controller('wechat')
export class WechatController {
  constructor(private readonly wechatService: WechatService) {}

  /**
   * 前台微信 JS-SDK 签名（公开，限流）。
   * url 必须是用户当前页完整地址（含 query、不含 #），与 wx.config 使用的 URL 一致。
   */
  @Get('signature')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  signature(@Query() query: WechatSignatureQueryDTO) {
    return this.wechatService.getSignature(query.url)
  }
}
