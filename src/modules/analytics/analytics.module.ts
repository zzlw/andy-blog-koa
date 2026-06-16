import { Module } from '@nestjs/common'
import { getModelProvider } from '@/core/database/model.transformer'
import { VisitorLog } from './analytics.model'
import { AnalyticsService } from './analytics.service'
import { AnalyticsController } from './analytics.controller'

@Module({
  controllers: [AnalyticsController],
  providers: [getModelProvider(VisitorLog), AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
