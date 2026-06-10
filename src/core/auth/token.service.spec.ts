import { JwtService } from '@nestjs/jwt'
import { TokenService, TokenType } from './token.service'
import { AuthorRole } from '@/constants/role.constant'
import {
  TokenExpiredException,
  TokenInvalidException,
} from '@/common/exceptions/biz.exception'

describe('TokenService', () => {
  let tokenService: TokenService

  beforeEach(() => {
    tokenService = new TokenService(new JwtService({ secret: 'test_secret' }))
  })

  it('access token 签发后可验证并还原 payload', () => {
    const token = tokenService.signAccessToken(1, AuthorRole.SUPER_ADMIN)
    const payload = tokenService.verify(token, TokenType.Access)
    expect(payload.uid).toBe(1)
    expect(payload.role).toBe(AuthorRole.SUPER_ADMIN)
    expect(payload.type).toBe(TokenType.Access)
  })

  it('refresh token 不能当作 access token 使用', () => {
    const refreshToken = tokenService.signRefreshToken(1, AuthorRole.AUTHOR)
    expect(() => tokenService.verify(refreshToken, TokenType.Access)).toThrow(
      TokenInvalidException,
    )
  })

  it('过期 token 抛出 TokenExpiredException（前端凭此刷新）', () => {
    const expired = new JwtService({ secret: 'test_secret' }).sign(
      { uid: 1, role: AuthorRole.AUTHOR, type: TokenType.Access },
      { expiresIn: -1 },
    )
    expect(() => tokenService.verify(expired, TokenType.Access)).toThrow(TokenExpiredException)
  })

  it('伪造签名 token 抛出 TokenInvalidException', () => {
    const forged = new JwtService({ secret: 'other_secret' }).sign({
      uid: 1,
      role: AuthorRole.SUPER_ADMIN,
      type: TokenType.Access,
    })
    expect(() => tokenService.verify(forged, TokenType.Access)).toThrow(TokenInvalidException)
  })

  it('从 Authorization 头解析 Bearer token', () => {
    expect(tokenService.extractFromHeader('Bearer abc')).toBe('abc')
    expect(tokenService.extractFromHeader('Basic abc')).toBeNull()
    expect(tokenService.extractFromHeader(undefined)).toBeNull()
  })
})
