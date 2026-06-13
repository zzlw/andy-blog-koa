import { FastifyRequest } from 'fastify'
import { Body, Controller, Get, Post, Put, Req } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Auth } from '@/common/decorators/auth.decorator'
import { Identity } from '@/common/decorators/identity.decorator'
import { SuccessMessage } from '@/common/decorators/success-message.decorator'
import { RequestIdentity } from '@/constants/role.constant'
import { TokenService } from '@/core/auth/token.service'
import { AuthorService } from './author.service'
import { LoginDTO, UpdateProfileDTO, UpdateSelfPasswordDTO } from './author.dto'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authorService: AuthorService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @SuccessMessage('登录成功')
  login(@Body() dto: LoginDTO) {
    return this.authorService.login(dto.name, dto.password)
  }

  /** refresh token 走 Authorization 头，由 service 显式校验（不经过 IdentityGuard） */
  @Post('refresh')
  @SuccessMessage('刷新成功')
  refresh(@Req() request: FastifyRequest) {
    const token = this.tokenService.extractFromHeader(request.headers.authorization)
    return this.authorService.refresh(token)
  }

  /**
   * 校验 access token 是否有效：仅返回 200 即代表通过。
   * 供外部服务（andy-blog-ai Worker 的后台鉴权中间件）反查后台令牌合法性，
   * Worker 侧只判断 HTTP 是否 2xx，不消费返回体。
   */
  @Post('verify-token')
  @Auth()
  @SuccessMessage('令牌有效')
  verifyToken(@Identity() identity: RequestIdentity) {
    return { author_id: identity.authorId, role: identity.role }
  }

  @Get('profile')
  @Auth()
  profile(@Identity() identity: RequestIdentity) {
    return this.authorService.profile(identity.authorId!)
  }

  @Put('profile')
  @Auth()
  @SuccessMessage('更新资料成功')
  updateProfile(@Identity() identity: RequestIdentity, @Body() dto: UpdateProfileDTO) {
    return this.authorService.update(identity.authorId!, dto)
  }

  @Put('password')
  @Auth()
  @SuccessMessage('修改密码成功')
  updatePassword(@Identity() identity: RequestIdentity, @Body() dto: UpdateSelfPasswordDTO) {
    return this.authorService.updateSelfPassword(identity.authorId!, dto)
  }
}
