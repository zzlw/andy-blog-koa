import { ArticleService } from './article.service'
import { ArticlePublic, ArticleStatus } from './article.model'
import {
  AuthorRole,
  GUEST_IDENTITY,
  IdentityType,
  RequestIdentity,
} from '@/constants/role.constant'
import { EVENT_ARTICLE_CHANGED } from '@/constants/event.constant'
import { NotFoundException } from '@/common/exceptions/biz.exception'

const ADMIN_IDENTITY: RequestIdentity = {
  type: IdentityType.Author,
  authorId: 1,
  role: AuthorRole.SUPER_ADMIN,
}

const queryChain = (result: unknown) => {
  const chain: any = {}
  for (const method of ['sort', 'skip', 'limit', 'lean']) {
    chain[method] = jest.fn().mockReturnValue(chain)
  }
  chain.exec = jest.fn().mockResolvedValue(result)
  return chain
}

const emptyRelationModel = () => ({
  find: jest.fn().mockReturnValue(queryChain([])),
})

describe('ArticleService', () => {
  let articleModel: any
  let eventEmitter: any
  let service: ArticleService

  beforeEach(() => {
    articleModel = {
      find: jest.fn().mockReturnValue(queryChain([])),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      findOneAndUpdate: jest.fn().mockReturnValue(queryChain(null)),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      deleteOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 1 }) }),
    }
    eventEmitter = { emit: jest.fn() }
    service = new ArticleService(
      articleModel,
      emptyRelationModel() as any,
      emptyRelationModel() as any,
      emptyRelationModel() as any,
      eventEmitter,
    )
  })

  it('Guest 列表被强制过滤为「已发布 + 公开」', async () => {
    await service.list({ status: ArticleStatus.Draft } as any, GUEST_IDENTITY)
    const filter = articleModel.find.mock.calls[0][0]
    expect(filter.public).toBe(ArticlePublic.Public)
    expect(filter.status).toBe(ArticleStatus.Published)
  })

  it('管理端列表可按 public/status 自由筛选', async () => {
    await service.list(
      { public: ArticlePublic.Private, status: ArticleStatus.Draft } as any,
      ADMIN_IDENTITY,
    )
    const filter = articleModel.find.mock.calls[0][0]
    expect(filter.public).toBe(ArticlePublic.Private)
    expect(filter.status).toBe(ArticleStatus.Draft)
  })

  it('keyword 转为 title/description 的不区分大小写正则', async () => {
    await service.list({ keyword: 'nest' } as any, GUEST_IDENTITY)
    const filter = articleModel.find.mock.calls[0][0]
    expect(filter.$or).toHaveLength(2)
    expect(filter.$or[0].title.test('Learn NestJS')).toBe(true)
  })

  it('Guest 访问不存在/未公开文章抛 NotFoundException', async () => {
    await expect(service.detail(999, GUEST_IDENTITY)).rejects.toThrow(NotFoundException)
    const filter = articleModel.findOneAndUpdate.mock.calls[0][0]
    expect(filter.public).toBe(ArticlePublic.Public)
  })

  it('创建/删除文章会发出 article.changed 事件（归档缓存失效）', async () => {
    await service.create({ title: 't', content: 'c' } as any)
    await service.remove(1)
    expect(eventEmitter.emit).toHaveBeenCalledTimes(2)
    expect(eventEmitter.emit).toHaveBeenCalledWith(EVENT_ARTICLE_CHANGED)
  })
})
