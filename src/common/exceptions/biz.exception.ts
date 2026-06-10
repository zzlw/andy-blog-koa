import { HttpException, HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@/constants/error-code.constant'

/**
 * 业务异常基类：携带语义化错误码，由全局 ExceptionFilter 统一格式化
 */
export class BizException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    message: string,
    status: HttpStatus,
  ) {
    super(message, status)
  }
}

export class AuthFailedException extends BizException {
  constructor(message = '认证失败') {
    super(ErrorCode.AUTH_FAILED, message, HttpStatus.UNAUTHORIZED)
  }
}

export class TokenInvalidException extends BizException {
  constructor(message = '令牌无效') {
    super(ErrorCode.TOKEN_INVALID, message, HttpStatus.UNAUTHORIZED)
  }
}

export class TokenExpiredException extends BizException {
  constructor(message = '令牌已过期') {
    super(ErrorCode.TOKEN_EXPIRED, message, HttpStatus.UNAUTHORIZED)
  }
}

export class RefreshFailedException extends BizException {
  constructor(message = '登录已失效，请重新登录') {
    super(ErrorCode.REFRESH_FAILED, message, HttpStatus.UNAUTHORIZED)
  }
}

export class NoPermissionException extends BizException {
  constructor(message = '权限不足') {
    super(ErrorCode.NO_PERMISSION, message, HttpStatus.FORBIDDEN)
  }
}

export class NotFoundException extends BizException {
  constructor(message = '资源不存在') {
    super(ErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND)
  }
}

export class ValidationFailedException extends BizException {
  constructor(message = '参数校验失败') {
    super(ErrorCode.VALIDATION_FAILED, message, HttpStatus.BAD_REQUEST)
  }
}

export class UploadFailedException extends BizException {
  constructor(message = '文件上传失败') {
    super(ErrorCode.UPLOAD_FAILED, message, HttpStatus.BAD_REQUEST)
  }
}
