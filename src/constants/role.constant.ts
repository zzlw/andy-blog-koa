/**
 * 作者权限等级（沿用旧库数值，迁移零转换）
 */
export enum AuthorRole {
  AUTHOR = 8,
  ADMIN = 16,
  SUPER_ADMIN = 32,
}

/** 请求者身份类型 */
export enum IdentityType {
  Guest = 'guest',
  Author = 'author',
}

export interface RequestIdentity {
  type: IdentityType
  /** 登录作者 ID（Guest 为 null） */
  authorId: number | null
  role: AuthorRole | null
}

export const GUEST_IDENTITY: RequestIdentity = Object.freeze({
  type: IdentityType.Guest,
  authorId: null,
  role: null,
})
