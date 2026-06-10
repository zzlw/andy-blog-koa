import { Injectable } from '@nestjs/common'
import { JwtService, TokenExpiredError } from '@nestjs/jwt'
import { APP_CONFIG } from '@/app.config'
import { AuthorRole } from '@/constants/role.constant'
import {
  TokenExpiredException,
  TokenInvalidException,
} from '@/common/exceptions/biz.exception'

export enum TokenType {
  Access = 'access',
  Refresh = 'refresh',
}

export interface TokenPayload {
  uid: number
  role: AuthorRole
  type: TokenType
}

/**
 * 双令牌体系：access(短) 负责接口鉴权，refresh(长) 仅用于换发新 access
 */
@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  signAccessToken(uid: number, role: AuthorRole): string {
    const payload: TokenPayload = { uid, role, type: TokenType.Access }
    return this.jwtService.sign(payload, { expiresIn: APP_CONFIG.auth.accessExpiresIn })
  }

  signRefreshToken(uid: number, role: AuthorRole): string {
    const payload: TokenPayload = { uid, role, type: TokenType.Refresh }
    return this.jwtService.sign(payload, { expiresIn: APP_CONFIG.auth.refreshExpiresIn })
  }

  /**
   * 验证 token 并断言类型
   * @throws TokenExpiredException access 过期（前端凭此触发刷新）
   * @throws TokenInvalidException 签名非法 / 类型不符
   */
  verify(token: string, expectedType: TokenType): TokenPayload {
    let payload: TokenPayload
    try {
      payload = this.jwtService.verify<TokenPayload>(token)
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new TokenExpiredException()
      }
      throw new TokenInvalidException()
    }
    if (payload.type !== expectedType) {
      throw new TokenInvalidException('令牌类型不符')
    }
    return payload
  }

  /** 从 Authorization: Bearer xxx 头解析 token */
  extractFromHeader(authorization?: string): string | null {
    if (!authorization) return null
    const [scheme, token] = authorization.split(' ')
    return scheme?.toLowerCase() === 'bearer' && token ? token : null
  }
}
