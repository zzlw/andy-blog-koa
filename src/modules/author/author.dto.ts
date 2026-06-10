import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator'
import { AuthorRole } from '@/constants/role.constant'

/** 密码规则：6~32 位，必须同时包含字母和数字 */
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[\S]{6,32}$/
const PASSWORD_MESSAGE = '密码需 6~32 位且同时包含字母和数字'

export class LoginDTO {
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  name: string

  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string
}

export class CreateAuthorDTO {
  @IsString()
  @Length(2, 32, { message: '用户名长度需 2~32 位' })
  name: string

  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password: string

  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string

  @IsOptional()
  @IsString()
  avatar?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string

  @IsOptional()
  @IsEnum(AuthorRole, { message: '角色不合法' })
  role?: AuthorRole
}

export class UpdateAuthorDTO {
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string

  @IsOptional()
  @IsString()
  avatar?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string

  @IsOptional()
  @IsEnum(AuthorRole, { message: '角色不合法' })
  role?: AuthorRole
}

/** 本人资料维护（不允许改角色） */
export class UpdateProfileDTO {
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string

  @IsOptional()
  @IsString()
  avatar?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string
}

export class UpdateSelfPasswordDTO {
  @IsString()
  @IsNotEmpty({ message: '原密码不能为空' })
  old_password: string

  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  new_password: string
}

export class ResetPasswordDTO {
  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password: string
}
