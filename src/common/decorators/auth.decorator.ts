import { SetMetadata } from '@nestjs/common'
import { AuthorRole } from '@/constants/role.constant'

export const AUTH_MIN_ROLE_KEY = 'auth:minRole'

/**
 * 路由鉴权声明：
 * @Auth() 任意登录作者；@Auth(AuthorRole.SUPER_ADMIN) 仅超级管理员
 * 未标注的路由为 Guest 可访问（守卫仍会尽力解析身份供业务消费）
 */
export const Auth = (minRole: AuthorRole = AuthorRole.AUTHOR) =>
  SetMetadata(AUTH_MIN_ROLE_KEY, minRole)
