import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateMessageDTO {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  nickname?: string

  @IsString()
  @IsNotEmpty({ message: '留言内容不能为空' })
  @MaxLength(1023)
  content: string
}
