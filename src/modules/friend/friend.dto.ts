import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'

export class CreateFriendDTO {
  @IsString()
  @IsNotEmpty({ message: '友链名称不能为空' })
  @MaxLength(64)
  name: string

  @IsUrl({}, { message: '友链地址必须是合法 URL' })
  link: string

  @IsOptional()
  @IsString()
  avatar?: string
}

export class UpdateFriendDTO extends PartialType(CreateFriendDTO) {}
