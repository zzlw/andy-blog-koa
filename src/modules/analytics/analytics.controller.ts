import { Controller, Get, Query } from '@nestjs/common'
import { Auth } from '@/common/decorators/auth.decorator'
import { AuthorRole } from '@/constants/role.constant'
import { AnalyticsService } from './analytics.service'
import { VisitorStatsQueryDTO } from './analytics.dto'

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /** 后台看板访客统计（每日 PV/UV），仅超管可见 */
  @Get('visitors')
  @Auth(AuthorRole.SUPER_ADMIN)
  visitors(@Query() query: VisitorStatsQueryDTO) {
    return this.analyticsService.getVisitorStats(query.range ?? '30d')
  }
}
