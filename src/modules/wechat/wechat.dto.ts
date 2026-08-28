import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class WechatSignatureQueryDTO {
  /** 当前页完整 URL（含 query），前端需去掉 # 哈希后再传入 */
  @IsString()
  @IsNotEmpty({ message: 'url 不能为空' })
  @MaxLength(2048)
  url: string
}
