---
title: 统一响应与语义化错误码：拦截器 + 异常过滤器
description: 让后端所有出口长一个样——成功走拦截器包装成统一信封，失败走异常过滤器配语义化错误码。前端从此只写一份处理逻辑，再也不用为每个接口的返回结构打补丁。
cover: ""
category: 后端工程
tags: [NestJS, TypeScript, 架构]
created_date: 2026-03-26
status: published
public: true
star: false
---

接手过老项目的人都懂那种痛：这个接口返回裸数组，那个返回 `{ data }`，出错时有的给 500 带 HTML，有的给 200 里塞个 `{ error: true }`。前端只能为每个接口写专属的兼容代码。

我重写博客后端时定了一条铁律：**所有出口，长一个样。** 成功和失败各有一条统一通道。

## 成功：拦截器统一包装

所有成功响应都被一个全局拦截器包装成同一个信封：

```ts
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const message =
      this.reflector.get<string>(SUCCESS_MESSAGE_KEY, context.getHandler()) || '请求成功'
    return next.handle().pipe(
      map((result) => ({
        status: ResponseStatus.Success,
        message,
        result: result ?? null,
      })),
    )
  }
}
```

于是 controller 只管返回业务数据，出口自动变成：

```json
{ "status": "success", "message": "发布文章成功", "result": { } }
```

那句 `message` 从哪来？一个 `@SuccessMessage()` 装饰器，用元数据标在 handler 上，拦截器再用 `Reflector` 读出来：

```ts
@Post()
@Auth()
@SuccessMessage('发布文章成功')
create(@Body() dto: CreateArticleDTO) {
  return this.articleService.create(dto)
}
```

「成功提示文案」既不污染业务逻辑，又能逐接口定制，没标的就用默认「请求成功」。

## 失败：语义化错误码 + 异常过滤器

HTTP 状态码太粗。`401` 到底是「没登录」「token 过期」还是「token 非法」？前端要做不同处理（跳登录 vs 静默刷新），光看 401 区分不了。

所以我引入一层**业务错误码**。一个携带错误码的异常基类：

```ts
export class BizException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    message: string,
    status: HttpStatus,
  ) {
    super(message, status)
  }
}
```

再派生出一组语义清晰的具体异常，每个都绑定 HTTP 状态 + 业务错误码：

```ts
export class AuthFailedException extends BizException {
  constructor(message = '认证失败') {
    super(ErrorCode.AUTH_FAILED, message, HttpStatus.UNAUTHORIZED)
  }
}

export class TokenExpiredException extends BizException {
  constructor(message = '令牌已过期') {
    super(ErrorCode.TOKEN_EXPIRED, message, HttpStatus.UNAUTHORIZED)
  }
}

export class NoPermissionException extends BizException {
  constructor(message = '权限不足') {
    super(ErrorCode.NO_PERMISSION, message, HttpStatus.FORBIDDEN)
  }
}
```

业务里抛异常变得极其自然——`throw new NotFoundException('文章不存在')`——不用关心怎么序列化。一个全局异常过滤器统一接住所有异常，格式化成和成功响应对称的信封：

```json
{ "status": "error", "message": "令牌已过期", "code": "TOKEN_EXPIRED" }
```

前端只需看 `code` 就能精确分支：`TOKEN_EXPIRED` 去刷新，`AUTH_FAILED` 跳登录，`NO_PERMISSION` 弹个「权限不足」。

## 这套设计的价值

1. **前端只写一份处理逻辑**：拦截 `status === 'error'` 统一报错，按 `code` 做少数特例分支，成功直接取 `result`。
2. **HTTP 语义和业务语义解耦**：HTTP 状态码给中间件/网关/监控看，错误码给前端业务看，各取所需。
3. **抛异常即终止**：service 里任何地方 `throw` 一个 BizException，链路自动中断并格式化，不用层层 `if (err) return`。
4. **可读、可枚举**：所有错误码集中在一个枚举里，是一份天然的「错误字典」，新人扫一眼就知道系统会抛哪些错。

## 小结

统一响应不是「好看」，而是「契约」。成功走拦截器、失败走异常过滤器，再用语义化错误码补齐 HTTP 状态码的粒度不足——前后端之间从此有一份稳定、自描述的交互契约，两边都省心。
