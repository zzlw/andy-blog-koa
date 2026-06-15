import { IsIn, IsOptional } from 'class-validator'

/** 看板访客统计支持的时间范围 */
export const ANALYTICS_RANGES = ['7d', '30d', '90d', '365d'] as const
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]

/** 各范围对应的天数 */
export const RANGE_DAYS: Record<AnalyticsRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
}

export class VisitorStatsQueryDTO {
  @IsOptional()
  @IsIn(ANALYTICS_RANGES)
  range?: AnalyticsRange
}
