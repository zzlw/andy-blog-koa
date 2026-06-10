import { Type } from 'class-transformer'
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'
import { PaginateQueryDTO } from '@/common/dtos/paginate.dto'
import { ArticlePublic, ArticleStar, ArticleStatus } from './article.model'

export class CreateArticleDTO {
  @IsString()
  @IsNotEmpty({ message: '标题不能为空' })
  @MaxLength(64)
  title: string

  @IsString()
  @IsNotEmpty({ message: '内容不能为空' })
  content: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string

  @IsOptional()
  @IsString()
  cover?: string

  @IsOptional()
  @IsDateString({}, { message: '发布日期格式不正确' })
  created_date?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  category_id?: number

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tag_ids?: number[]

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  author_ids?: number[]

  @IsOptional()
  @IsEnum(ArticlePublic)
  public?: ArticlePublic

  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus

  @IsOptional()
  @IsEnum(ArticleStar)
  star?: ArticleStar
}

export class UpdateArticleDTO extends PartialType(CreateArticleDTO) {}

export class ArticleListQueryDTO extends PaginateQueryDTO {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  category_id?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tag_id?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  author_id?: number

  @IsOptional()
  @IsString()
  @MaxLength(60)
  keyword?: string

  @IsOptional()
  @Type(() => Number)
  @IsEnum(ArticleStar)
  star?: ArticleStar

  /** 仅管理端生效：Guest 会被强制过滤 */
  @IsOptional()
  @Type(() => Number)
  @IsEnum(ArticlePublic)
  public?: ArticlePublic

  /** 仅管理端生效：Guest 会被强制过滤 */
  @IsOptional()
  @Type(() => Number)
  @IsEnum(ArticleStatus)
  status?: ArticleStatus
}
