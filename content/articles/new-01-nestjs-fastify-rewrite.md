---
title: 用 NestJS + Fastify 重写 Koa 博客后端：架构取舍与收益
description: 把一套基于 Koa 的个人博客后端用 NestJS + Fastify 重写，记录模块化分层、统一响应、依赖注入带来的可维护性提升，以及为什么选 Fastify 而不是 Express。
cover: ""
category: 后端工程
tags: [NestJS, Fastify, Node.js, TypeScript, 架构]
created_date: 2026-02-18
status: published
public: true
star: true
---

我的博客后端最早是一套基于 Koa 的轻量服务：一堆 router、一层 middleware、controller 里直接写业务。能跑，但随着功能变多（文章、分类、标签、评论、留言、友链、鉴权、文件上传……），它开始显出问题：依赖关系靠 `require` 隐式串联，公共逻辑（鉴权、分页、响应包装）到处复制，写测试要手动 mock 一大堆东西。

于是我用 **NestJS + Fastify** 把它完整重写了一遍。这篇文章记录这次重写的取舍。

## 为什么是 NestJS

Koa 给的是「自由」，NestJS 给的是「约束」。对一个会长期演进的项目来说，约束往往更值钱：

- **模块化**：每个领域（article / category / tag / author …）是一个 `Module`，自带 controller、service、model，边界清晰。
- **依赖注入**：service 之间通过构造函数注入，依赖关系是显式的、可替换的，写单测时直接注入 mock。
- **声明式横切关注点**：鉴权用 `@Auth()` 装饰器、响应包装用拦截器、异常用过滤器，业务代码里看不到这些噪音。

一个典型的 controller 干净到几乎只剩「路由 → service」的映射：

```ts
@Controller('articles')
export class ArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly archiveService: ArchiveService,
  ) {}

  @Post()
  @Auth()
  @SuccessMessage('发布文章成功')
  create(@Body() dto: CreateArticleDTO) {
    return this.articleService.create(dto)
  }
}
```

`@Auth()` 负责鉴权，`@SuccessMessage()` 负责成功提示，`CreateArticleDTO` 配合全局 `ValidationPipe` 负责入参校验——controller 本身只表达「做什么」。

## 为什么是 Fastify 而不是 Express

NestJS 默认跑在 Express 上，但它也官方支持 Fastify 适配器。我选了 Fastify：

- 更高的吞吐与更低的开销，schema-based 的序列化对 JSON API 很友好；
- 内置的 `@fastify/multipart` 处理文件上传，配合我对象存储那层很顺手；
- 对个人项目而言，单机资源有限，能省一点是一点。

切换成本几乎为零——把 `NestFactory.create` 换成 `FastifyAdapter` 即可，业务层完全无感，这正是 Nest「平台无关」抽象的价值。

## 统一响应与分层

重写时我立了一条规矩：**所有出口响应长一个样**。通过一个全局拦截器把任意返回值包装成：

```json
{ "status": "success", "message": "发布文章成功", "result": { } }
```

错误则由全局异常过滤器统一成同样的信封 + 语义化错误码。前端再也不用为「这个接口返回的是裸数组、那个接口返回 `{data}`」写一堆兼容代码。

分层上我保持了克制：`controller`（路由 + 校验）→ `service`（业务）→ `model`（数据）。没有为了「整洁架构」硬塞 repository / usecase 层——个人博客的复杂度不配那么多层，过度分层只会让人来回跳文件。

## 收益

重写后最直观的变化：

1. **加功能变快了**。新增一个「友链」模块就是 `nest g module/controller/service` 三连 + 一个 model，公共能力（鉴权、分页、响应、异常）全都白嫖。
2. **测试能写了**。service 依赖通过 DI 注入，单测里 mock 一个 model 就能跑，`*.service.spec.ts` 覆盖了核心分支。
3. **认知负担降了**。任何一个接口出问题，顺着 `module → controller → service` 三步就能定位，不用在 middleware 链里大海捞针。

代价是引入了装饰器、DI 容器这套心智模型，初次上手有学习曲线。但对一个要长期维护、还要持续接新东西（比如后来接的 AI 知识库 Webhook）的项目，这点前期成本非常划算。

## 小结

Koa 适合「小而美、生命周期短」的服务；一旦项目要长期演进、模块会持续变多，NestJS 的结构化约束 + Fastify 的性能是更稳的组合。重写不是为了追新，而是为了让「明年的我」还能轻松改动「今年的代码」。
