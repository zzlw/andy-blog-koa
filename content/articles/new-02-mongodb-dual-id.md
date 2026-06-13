---
title: MongoDB 双 ID 体系：为什么同时保留 _id 与自增 id
description: 一篇文章既有 MongoDB 的 ObjectId（_id），又有一个从 1 开始自增的数字 id。看似冗余，背后是对 URL 友好性、外部引用稳定性与查询性能的权衡。
cover: ""
category: 后端工程
tags: [MongoDB, Typegoose, Node.js, 架构]
created_date: 2026-02-25
status: published
public: true
star: false
---

在我的博客后端里，几乎每个核心模型（文章、分类、标签、作者）都同时拥有两个标识：MongoDB 自带的 `_id`（ObjectId），以及一个从 1 开始自增的数字 `id`。第一次看到的人都会问：这不是冗余吗？

不是。这是个有意的设计，我把它叫做「双 ID 体系」。

## 两种 ID 各自的问题

**ObjectId（`_id`）** 是 MongoDB 的默认主键，全局唯一、分布式友好、自带时间戳。但它有两个使用上的痛点：

- 它是 24 位十六进制字符串，丑且长，放进 URL 里像 `/article/65f1a2b3c4d5e6f7a8b9c0d1`，对人和 SEO 都不友好；
- 它不可读、不可排序成「第几篇」，对外暴露还会泄露一点写入时间信息。

**纯自增数字 id** 则相反：`/article/42` 简洁、可读、对 SEO 友好，但它不是 MongoDB 原生能力，需要插件维护一个计数器。

我的选择是：**两个都留，各司其职。**

## 实现：Typegoose + auto-increment 插件

借助 `@typegoose/auto-increment`，给模型挂一个自增字段即可：

```ts
@plugin(AutoIncrementID, { field: 'id', startAt: 1 })
@modelOptions({
  schemaOptions: {
    collection: 'articles',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  },
})
export class Article {
  @prop({ unique: true, index: true })
  id?: number

  @prop({ required: true, trim: true, maxlength: 64 })
  title: string
  // ...
}
```

`_id` 仍由 MongoDB 自动生成、做物理主键；`id` 是带唯一索引的业务主键，对外的一切引用都用它。

## 关键：所有关联都用数字 id

这套体系真正的价值在「关联」上。我没有用 Mongoose 的 `ObjectId` ref + `populate`，而是让文章用数字 id 数组引用分类、标签、作者：

```ts
@prop({ default: null, index: true })
category_id: number | null

@prop({ type: () => [Number], default: [], index: true })
tag_ids: number[]
```

查询时手动做一次「批量取 + 内联」，避免 N+1：

```ts
const categoryIds = [...new Set(articles.map((a) => a.category_id).filter(Boolean))]
const tagIds = [...new Set(articles.flatMap((a) => a.tag_ids ?? []))]

const [categories, tags] = await Promise.all([
  this.categoryModel.find({ id: { $in: categoryIds } }).lean().exec(),
  this.tagModel.find({ id: { $in: tagIds } }).lean().exec(),
])
```

这样做的好处：

- **外部引用稳定且可读**：前端、AI 知识库、其他服务引用文章时用 `42` 而不是一串 ObjectId；
- **解耦存储细节**：万一哪天换底层存储，业务主键 `id` 的语义不变；
- **可控的关联展开**：用 `$in` 一次性取齐再 `Map` 内联，性能和行为都在自己手里，不依赖 `populate` 的隐式行为。

## 兼容历史数据的额外收益

我这套后端是从旧 Koa 版本迁移来的，旧库里的文章本来就用数字 id 互相引用。保留自增 `id` 让我可以**无损迁移**：旧文章的 id、它们之间的分类/标签关系原样保留，前端的文章链接（`/article/123`）也不会全部失效。如果当初只用 ObjectId，迁移就得重建所有引用、所有外链全挂。

## 代价与注意点

- 自增 id 依赖一个计数器文档，高并发写入下要注意它不是「无锁」的；个人博客写入量极低，完全无所谓。
- 要约束纪律：**对内可以用 `_id`，对外一律用 `id`**。一旦混用，又回到丑 URL 的老路。

## 小结

`_id` 负责「机器视角」的唯一性与存储，`id` 负责「人 / 外部系统视角」的可读引用。一点点冗余，换来 URL 友好、引用稳定、迁移无损——对一个要长期维护、还要被外部（AI 服务、前端、SEO）大量引用的内容系统，这笔账很值。
