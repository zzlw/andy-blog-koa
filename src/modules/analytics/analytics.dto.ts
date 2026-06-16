import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

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

/** 前台埋点上报参数：仅路径，经 query 传入以规避跨域预检（sendBeacon 友好） */
export class CollectVisitDTO {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  path?: string
}
