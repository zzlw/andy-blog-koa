import { Type } from 'class-transformer'
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateCommentDTO {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  article_id: number

  /** 回复评论时传父评论 ID，顶级评论省略 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parent_id?: number

  @IsString()
  @IsNotEmpty({ message: '昵称不能为空' })
  @MaxLength(32)
  nickname: string

  @IsString()
  @IsNotEmpty({ message: '评论内容不能为空' })
  @MaxLength(1023)
  content: string

  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string

  @IsOptional()
  @IsUrl({}, { message: '网址格式不正确' })
  website?: string
}

export class CommentListQueryDTO {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  article_id: number
}
