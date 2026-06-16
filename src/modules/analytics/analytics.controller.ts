import { FastifyRequest } from 'fastify'
import { Controller, Get, Post, Query, Req } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Auth } from '@/common/decorators/auth.decorator'
import { AuthorRole } from '@/constants/role.constant'
import { AnalyticsService } from './analytics.service'
import { CollectVisitDTO, VisitorStatsQueryDTO } from './analytics.dto'

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * 前台埋点上报（公开，限流）。path 经 query 传入（sendBeacon 无自定义头 → 规避跨域预检），
   * IP/UA 由服务端从请求解析，前端无需也不应自行上传。
   */
  @Post('collect')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async collect(@Query() dto: CollectVisitDTO, @Req() request: FastifyRequest) {
    const ip = this.clientIp(request)
    const ua = (request.headers['user-agent'] as string) ?? ''
    await this.analyticsService.collect({ ip, ua, path: dto.path })
    return { ok: true }
  }

  /** 后台看板访客统计（每日 PV/UV），仅超管可见 */
  @Get('visitors')
  @Auth(AuthorRole.SUPER_ADMIN)
  visitors(@Query() query: VisitorStatsQueryDTO) {
    return this.analyticsService.getVisitorStats(query.range ?? '30d')
  }

  /** 访客分析洞察（地区/国家/页面 Top + 最近访客），仅超管可见 */
  @Get('insights')
  @Auth(AuthorRole.SUPER_ADMIN)
  insights(@Query() query: VisitorStatsQueryDTO) {
    return this.analyticsService.getInsights(query.range ?? '30d')
  }

  /** 取真实客户端 IP：优先 nginx 注入的 X-Forwarded-For / X-Real-IP */
  private clientIp(request: FastifyRequest): string {
    const xff = request.headers['x-forwarded-for']
    if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim()
    const xri = request.headers['x-real-ip']
    if (typeof xri === 'string' && xri.length) return xri
    return request.ip || 'unknown'
  }
}
