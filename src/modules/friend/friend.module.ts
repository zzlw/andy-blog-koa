import { Module } from '@nestjs/common'
import { getModelProvider } from '@/core/database/model.transformer'
import { Friend } from './friend.model'
import { FriendService } from './friend.service'
import { FriendController } from './friend.controller'

@Module({
  controllers: [FriendController],
  providers: [getModelProvider(Friend), FriendService],
  exports: [FriendService],
})
export class FriendModule {}
