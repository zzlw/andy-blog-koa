export enum ResponseStatus {
  Success = 'success',
  Error = 'error',
}

export interface Pagination {
  page: number
  page_size: number
  total: number
  total_page: number
}

export interface PaginateResult<T> {
  data: T[]
  pagination: Pagination
}

export interface HttpResponseSuccess<T> {
  status: ResponseStatus.Success
  message: string
  result: T
}

export interface HttpResponseError {
  status: ResponseStatus.Error
  message: string
  /** 语义化错误码，见 ErrorCode */
  error: string
}
