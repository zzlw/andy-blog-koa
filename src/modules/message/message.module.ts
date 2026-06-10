import { Module } from '@nestjs/common'
import { getModelProvider } from '@/core/database/model.transformer'
import { Message } from './message.model'
import { MessageService } from './message.service'
import { MessageController } from './message.controller'

@Module({
  controllers: [MessageController],
  providers: [getModelProvider(Message), MessageService],
  exports: [MessageService],
})
export class MessageModule {}
