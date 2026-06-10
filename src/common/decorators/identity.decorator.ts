import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { GUEST_IDENTITY, RequestIdentity } from '@/constants/role.constant'

/** 控制器参数装饰器：取当前请求身份（守卫注入） */
export const Identity = createParamDecorator(
  (_: unknown, context: ExecutionContext): RequestIdentity => {
    const request = context.switchToHttp().getRequest()
    return request.identity ?? GUEST_IDENTITY
  },
)
