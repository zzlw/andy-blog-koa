import { CommentService } from './comment.service'
import {
  NotFoundException,
  ValidationFailedException,
} from '@/common/exceptions/biz.exception'

const queryChain = (result: unknown) => {
  const chain: any = {}
  for (const method of ['sort', 'lean']) {
    chain[method] = jest.fn().mockReturnValue(chain)
  }
  chain.exec = jest.fn().mockResolvedValue(result)
  return chain
}

describe('CommentService', () => {
  let commentModel: any
  let articleModel: any
  let service: CommentService

  beforeEach(() => {
    commentModel = {
      findOne: jest.fn().mockReturnValue(queryChain(null)),
      create: jest.fn().mockImplementation(async (doc) => doc),
      findOneAndUpdate: jest.fn().mockReturnValue(queryChain({ id: 1, like: 2 })),
    }
    articleModel = { exists: jest.fn().mockResolvedValue({ _id: 'x' }) }
    service = new CommentService(commentModel, articleModel)
  })

  it('文章不存在时禁止评论', async () => {
    articleModel.exists.mockResolvedValue(null)
    await expect(
      service.create({ article_id: 999, nickname: 'n', content: 'c' }),
    ).rejects.toThrow(NotFoundException)
  })

  it('顶级评论 parent_id 默认为 0', async () => {
    const comment = await service.create({ article_id: 1, nickname: 'n', content: 'c' })
    expect(comment.parent_id).toBe(0)
  })

  it('回复的父评论必须存在且属于同一篇文章', async () => {
    await expect(
      service.create({ article_id: 1, parent_id: 7, nickname: 'n', content: 'c' }),
    ).rejects.toThrow(ValidationFailedException)
    expect(commentModel.findOne).toHaveBeenCalledWith({ id: 7, article_id: 1 })
  })

  it('点赞返回最新 like 数', async () => {
    await expect(service.like(1)).resolves.toEqual({ like: 2 })
    expect(commentModel.findOneAndUpdate).toHaveBeenCalledWith(
      { id: 1 },
      { $inc: { like: 1 } },
      { new: true },
    )
  })
})
