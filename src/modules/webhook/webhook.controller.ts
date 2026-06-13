import { Controller, Post } from '@nestjs/common'
import { Auth } from '@/common/decorators/auth.decorator'
import { SuccessMessage } from '@/common/decorators/success-message.decorator'
import { AuthorRole } from '@/constants/role.constant'
import { WebhookService } from './webhook.service'

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * 全量回填 AI 知识库：同步站点/作者信息 + 所有已发布公开文章。
   * 用于首次接入或知识库重建，仅超级管理员可调用。
   */
  @Post('sync')
  @Auth(AuthorRole.SUPER_ADMIN)
  @SuccessMessage('已触发知识库全量同步')
  sync() {
    return this.webhookService.syncAll()
  }
}
