/**
 * 业务错误码（字符串语义化，配合标准 HTTP 状态码使用）
 * 前端拦截器依赖：401 + TOKEN_EXPIRED 触发静默刷新
 */
export enum ErrorCode {
  AUTH_FAILED = 'AUTH_FAILED', // 凭据错误 / 未携带 token
  TOKEN_INVALID = 'TOKEN_INVALID', // token 非法
  TOKEN_EXPIRED = 'TOKEN_EXPIRED', // access token 过期（可刷新）
  REFRESH_FAILED = 'REFRESH_FAILED', // refresh token 失效（需重新登录）
  NO_PERMISSION = 'NO_PERMISSION', // 权限不足
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  SERVER_ERROR = 'SERVER_ERROR',
}
