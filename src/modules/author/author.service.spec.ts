import { hashSync } from 'bcryptjs'
import { JwtService } from '@nestjs/jwt'
import { AuthorService } from './author.service'
import { TokenService, TokenType } from '@/core/auth/token.service'
import { AuthorRole } from '@/constants/role.constant'
import {
  AuthFailedException,
  RefreshFailedException,
} from '@/common/exceptions/biz.exception'

const queryChain = (result: unknown) => {
  const chain: any = {}
  for (const method of ['select', 'sort', 'lean']) {
    chain[method] = jest.fn().mockReturnValue(chain)
  }
  chain.exec = jest.fn().mockResolvedValue(result)
  return chain
}

describe('AuthorService', () => {
  const tokenService = new TokenService(new JwtService({ secret: 'test_secret' }))
  const password = hashSync('abc123456', 4)
  const author = { id: 1, name: 'andy', role: AuthorRole.SUPER_ADMIN, password }

  const createService = (model: any) => new AuthorService(model, tokenService)

  it('登录成功签发双令牌', async () => {
    const model: any = { findOne: jest.fn().mockReturnValue(queryChain(author)) }
    const tokens = await createService(model).login('andy', 'abc123456')

    const accessPayload = tokenService.verify(tokens.access_token, TokenType.Access)
    const refreshPayload = tokenService.verify(tokens.refresh_token, TokenType.Refresh)
    expect(accessPayload.uid).toBe(1)
    expect(accessPayload.role).toBe(AuthorRole.SUPER_ADMIN)
    expect(refreshPayload.uid).toBe(1)
  })

  it('密码错误抛出 AuthFailedException', async () => {
    const model: any = { findOne: jest.fn().mockReturnValue(queryChain(author)) }
    await expect(createService(model).login('andy', 'wrong-pass')).rejects.toThrow(
      AuthFailedException,
    )
  })

  it('用户不存在抛出 AuthFailedException', async () => {
    const model: any = { findOne: jest.fn().mockReturnValue(queryChain(null)) }
    await expect(createService(model).login('ghost', 'abc123456')).rejects.toThrow(
      AuthFailedException,
    )
  })

  it('refresh token 合法且作者存在时换发新令牌', async () => {
    const model: any = { findOne: jest.fn().mockReturnValue(queryChain(author)) }
    const refreshToken = tokenService.signRefreshToken(1, AuthorRole.SUPER_ADMIN)
    const tokens = await createService(model).refresh(refreshToken)
    expect(tokenService.verify(tokens.access_token, TokenType.Access).uid).toBe(1)
  })

  it('用 access token 调刷新接口应被拒绝', async () => {
    const model: any = { findOne: jest.fn().mockReturnValue(queryChain(author)) }
    const accessToken = tokenService.signAccessToken(1, AuthorRole.SUPER_ADMIN)
    await expect(createService(model).refresh(accessToken)).rejects.toThrow(
      RefreshFailedException,
    )
  })
})
