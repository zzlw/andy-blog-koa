import { FilterQuery, Model, ProjectionType, SortOrder } from 'mongoose'
import { PaginateResult } from '@/interfaces/response.interface'

export interface PaginateOptions {
  page?: number
  pageSize?: number
  sort?: Record<string, SortOrder>
  projection?: ProjectionType<any>
}

export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 100

/** 通用分页查询 */
export async function paginate<T>(
  model: Model<T>,
  filter: FilterQuery<T>,
  options: PaginateOptions = {},
): Promise<PaginateResult<T>> {
  const page = Math.max(Number(options.page) || 1, 1)
  const pageSize = Math.min(Math.max(Number(options.pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)

  const [data, total] = await Promise.all([
    model
      .find(filter, options.projection)
      .sort(options.sort ?? { id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec(),
    model.countDocuments(filter).exec(),
  ])

  return {
    data: data as T[],
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_page: Math.ceil(total / pageSize),
    },
  }
}
