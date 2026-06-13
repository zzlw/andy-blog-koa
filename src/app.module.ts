import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'

import { DatabaseModule } from '@/core/database/database.module'
import { CacheModule } from '@/core/cache/cache.module'
import { AuthCoreModule } from '@/core/auth/auth.module'

import { IdentityGuard } from '@/common/guards/identity.guard'
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor'
import { AllExceptionFilter } from '@/common/filters/http-exception.filter'

import { ArticleModule } from '@/modules/article/article.module'
import { ArchiveModule } from '@/modules/archive/archive.module'
import { CategoryModule } from '@/modules/category/category.module'
import { TagModule } from '@/modules/tag/tag.module'
import { CommentModule } from '@/modules/comment/comment.module'
import { MessageModule } from '@/modules/message/message.module'
import { FriendModule } from '@/modules/friend/friend.module'
import { AuthorModule } from '@/modules/author/author.module'
import { FileModule } from '@/modules/file/file.module'
import { WebhookModule } from '@/modules/webhook/webhook.module'

@Module({
  imports: [
    // 全局限流：兜底 300 次/分钟，敏感接口（登录/评论/留言）另行收紧
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    CacheModule,
    AuthCoreModule,
    AuthorModule,
    ArticleModule,
    ArchiveModule,
    CategoryModule,
    TagModule,
    CommentModule,
    MessageModule,
    FriendModule,
    FileModule,
    WebhookModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: IdentityGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionFilter },
  ],
})
export class AppModule {}
