import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import {
  AuthorRole,
  GUEST_IDENTITY,
  IdentityType,
  RequestIdentity,
} from '@/constants/role.constant'
import {
  AuthFailedException,
  NoPermissionException,
} from '@/common/exceptions/biz.exception'
import { TokenService, TokenType } from '@/core/auth/token.service'
import { AUTH_MIN_ROLE_KEY } from '@/common/decorators/auth.decorator'

/**
 * 全局身份守卫（仿 nodepress Identity 思路）：
 * 1. 对所有请求尽力解析 Bearer access token，将身份挂到 request.identity
 * 2. 仅对标注 @Auth(minRole) 的路由强制校验登录态与角色等级
 */
@Injectable()
export class IdentityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const minRole = this.reflector.getAllAndOverride<AuthorRole | undefined>(AUTH_MIN_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    const isProtected = minRole !== undefined

    const token = this.tokenService.extractFromHeader(request.headers?.authorization)

    if (!token) {
      if (isProtected) throw new AuthFailedException('请先登录')
      request.identity = GUEST_IDENTITY
      return true
    }

    let identity: RequestIdentity
    try {
      const payload = this.tokenService.verify(token, TokenType.Access)
      identity = { type: IdentityType.Author, authorId: payload.uid, role: payload.role }
    } catch (error) {
      // 公开路由容忍坏 token（按 Guest 处理）；受保护路由如实抛出（过期/非法）
      if (isProtected) throw error
      identity = GUEST_IDENTITY
    }

    request.identity = identity

    if (isProtected && (identity.role ?? 0) < minRole) {
      throw new NoPermissionException()
    }
    return true
  }
}
