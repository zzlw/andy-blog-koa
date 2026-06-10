import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'

export class CreateCategoryDTO {
  @IsString()
  @IsNotEmpty({ message: '分类名称不能为空' })
  @MaxLength(64)
  name: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string

  @IsOptional()
  @IsString()
  cover?: string
}

export class UpdateCategoryDTO extends PartialType(CreateCategoryDTO) {}
