import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'

export class CreateSongDTO {
  @IsString()
  @IsNotEmpty({ message: '曲名不能为空' })
  @MaxLength(200)
  name: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  artist?: string

  @IsString()
  @IsNotEmpty({ message: '音频地址不能为空' })
  url: string

  @IsOptional()
  @IsString()
  cover?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number
}

export class UpdateSongDTO extends PartialType(CreateSongDTO) {}

export class BatchCreateSongsDTO {
  @IsArray()
  @ArrayMinSize(1, { message: '至少提交一首歌曲' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateSongDTO)
  songs: CreateSongDTO[]
}
