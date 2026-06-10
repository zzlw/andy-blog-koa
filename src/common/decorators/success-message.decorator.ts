import { SetMetadata } from '@nestjs/common'

export const SUCCESS_MESSAGE_KEY = 'response:successMessage'

/** 自定义成功响应的 message 文案，由 TransformInterceptor 消费 */
export const SuccessMessage = (message: string) => SetMetadata(SUCCESS_MESSAGE_KEY, message)
