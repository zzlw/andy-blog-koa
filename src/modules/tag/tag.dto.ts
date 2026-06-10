import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class CreateTagDTO {
  @IsString()
  @IsNotEmpty({ message: '标签名称不能为空' })
  @MaxLength(64)
  name: string
}

export class UpdateTagDTO extends CreateTagDTO {}
