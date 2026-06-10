import { FastifyReply } from 'fastify'
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { ErrorCode } from '@/constants/error-code.constant'
import { ResponseStatus } from '@/interfaces/response.interface'
import { BizException } from '@/common/exceptions/biz.exception'

/**
 * 全局异常过滤器：统一错误响应 { status: 'error', message, error }
 */
@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<FastifyReply>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = '服务器开小差了'
    let errorCode: string = ErrorCode.SERVER_ERROR

    if (exception instanceof BizException) {
      status = exception.getStatus()
      message = exception.message
      errorCode = exception.errorCode
    } else if (exception instanceof HttpException) {
      status = exception.getStatus()
      const body = exception.getResponse()
      if (typeof body === 'string') {
        message = body
      } else {
        // ValidationPipe 的错误信息为 string[]，取拼接结果
        const anyBody = body as any
        message = Array.isArray(anyBody.message)
          ? anyBody.message.join('；')
          : anyBody.message || exception.message
      }
      errorCode =
        status === HttpStatus.BAD_REQUEST
          ? ErrorCode.VALIDATION_FAILED
          : status === HttpStatus.NOT_FOUND
            ? ErrorCode.NOT_FOUND
            : ErrorCode.SERVER_ERROR
    } else {
      this.logger.error('Unhandled exception', exception as Error)
    }

    response.status(status).send({
      status: ResponseStatus.Error,
      message,
      error: errorCode,
    })
  }
}
