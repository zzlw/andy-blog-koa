import { map, Observable } from 'rxjs'
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ResponseStatus } from '@/interfaces/response.interface'
import { SUCCESS_MESSAGE_KEY } from '@/common/decorators/success-message.decorator'

/**
 * 统一成功响应结构：{ status: 'success', message, result }
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const message =
      this.reflector.get<string>(SUCCESS_MESSAGE_KEY, context.getHandler()) || '请求成功'
    return next.handle().pipe(
      map((result) => ({
        status: ResponseStatus.Success,
        message,
        result: result ?? null,
      })),
    )
  }
}
