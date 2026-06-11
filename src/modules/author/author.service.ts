import { Model } from 'mongoose'
import { compareSync, hashSync } from 'bcryptjs'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { APP_CONFIG } from '@/app.config'
import { AuthorRole } from '@/constants/role.constant'
import { InjectModel } from '@/core/database/model.transformer'
import { TokenService, TokenType } from '@/core/auth/token.service'
import {
  AuthFailedException,
  NotFoundException,
  RefreshFailedException,
  ValidationFailedException,
} from '@/common/exceptions/biz.exception'
import { Author, AUTHOR_SAFE_PROJECTION } from './author.model'
import {
  CreateAuthorDTO,
  ResetPasswordDTO,
  UpdateAuthorDTO,
  UpdateProfileDTO,
  UpdateSelfPasswordDTO,
} from './author.dto'

const BCRYPT_ROUNDS = 10

@Injectable()
export class AuthorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthorService.name)

  constructor(
    @InjectModel(Author) private readonly authorModel: Model<Author>,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * 空库种子：authors 集合为空时自动创建超管，解决全新环境
   * 「登录需要账号、建账号需要登录」的死锁（make reset / 全新部署）。
   * 幂等：库里有任何作者即跳过，不影响数据导入方案。
   */
  async onApplicationBootstrap() {
    const count = await this.authorModel.countDocuments({}).exec()
    if (count > 0) return

    const { name, password } = APP_CONFIG.auth.initAdmin
    await this.authorModel.create({
      name,
      password: hashSync(password, BCRYPT_ROUNDS),
      role: AuthorRole.SUPER_ADMIN,
    })
    this.logger.warn(
      `检测到空库，已自动创建超级管理员「${name}」（密码来自 ADMIN_INIT_PASSWORD，未配置则为开发默认值），请首次登录后立即修改密码`,
    )
  }

  /** 登录：校验凭据，签发双令牌 */
  async login(name: string, password: string) {
    const author = await this.authorModel.findOne({ name }).select('+password').lean().exec()
    if (!author || !compareSync(password, author.password)) {
      throw new AuthFailedException('用户名或密码错误')
    }
    return this.issueTokens(author.id!, author.role)
  }

  /** 刷新：refresh token 换发新双令牌 */
  async refresh(refreshToken: string | null) {
    if (!refreshToken) throw new RefreshFailedException()
    let payload
    try {
      payload = this.tokenService.verify(refreshToken, TokenType.Refresh)
    } catch {
      throw new RefreshFailedException()
    }
    const author = await this.authorModel.findOne({ id: payload.uid }).lean().exec()
    if (!author) throw new RefreshFailedException()
    return this.issueTokens(author.id!, author.role)
  }

  async profile(uid: number) {
    const author = await this.authorModel
      .findOne({ id: uid }, AUTHOR_SAFE_PROJECTION)
      .lean()
      .exec()
    if (!author) throw new NotFoundException('作者不存在')
    return author
  }

  list() {
    return this.authorModel.find({}, AUTHOR_SAFE_PROJECTION).sort({ id: 1 }).lean().exec()
  }

  detail(id: number) {
    return this.profile(id)
  }

  async create(dto: CreateAuthorDTO) {
    const existed = await this.authorModel.exists({ name: dto.name })
    if (existed) throw new ValidationFailedException('用户名已存在')
    const author = await this.authorModel.create({
      ...dto,
      password: hashSync(dto.password, BCRYPT_ROUNDS),
    })
    return this.profile(author.id!)
  }

  async update(id: number, dto: UpdateAuthorDTO | UpdateProfileDTO) {
    const author = await this.authorModel
      .findOneAndUpdate({ id }, { $set: dto }, { new: true, projection: AUTHOR_SAFE_PROJECTION })
      .lean()
      .exec()
    if (!author) throw new NotFoundException('作者不存在')
    return author
  }

  /** 本人改密：需验证原密码 */
  async updateSelfPassword(uid: number, dto: UpdateSelfPasswordDTO) {
    const author = await this.authorModel.findOne({ id: uid }).select('+password').lean().exec()
    if (!author) throw new NotFoundException('作者不存在')
    if (!compareSync(dto.old_password, author.password)) {
      throw new AuthFailedException('原密码错误')
    }
    await this.setPassword(uid, dto.new_password)
  }

  /** 超管重置任意作者密码 */
  async resetPassword(id: number, dto: ResetPasswordDTO) {
    const existed = await this.authorModel.exists({ id })
    if (!existed) throw new NotFoundException('作者不存在')
    await this.setPassword(id, dto.password)
  }

  async remove(id: number, operatorId: number) {
    if (id === operatorId) {
      throw new ValidationFailedException('不能删除自己')
    }
    const result = await this.authorModel.deleteOne({ id }).exec()
    if (!result.deletedCount) throw new NotFoundException('作者不存在')
  }

  private async setPassword(id: number, password: string) {
    await this.authorModel
      .updateOne({ id }, { $set: { password: hashSync(password, BCRYPT_ROUNDS) } })
      .exec()
  }

  private issueTokens(uid: number, role: Author['role']) {
    return {
      access_token: this.tokenService.signAccessToken(uid, role),
      refresh_token: this.tokenService.signRefreshToken(uid, role),
    }
  }
}
