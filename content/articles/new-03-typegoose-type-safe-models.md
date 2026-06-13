---
title: Typegoose 实战：用装饰器写出类型安全的 Mongoose 模型
description: Mongoose 的 Schema 和 TypeScript 类型天然是两份东西，容易写着写着就对不上。Typegoose 用一个 class + 装饰器同时定义二者，让模型既是 schema 又是类型。
cover: ""
category: 后端工程
tags: [Typegoose, MongoDB, TypeScript, NestJS]
created_date: 2026-03-04
status: published
public: true
star: false
---

用原生 Mongoose 写 TypeScript 项目，最别扭的地方是「一件事写两遍」：一份 `Schema` 给运行时，一份 `interface` 给类型检查。它们靠人肉保持同步，加个字段忘了改另一边，编译器还不报错，问题留到运行时才爆。

Typegoose 解决的就是这个：**用一个 class + 装饰器，同时产出 schema 和类型。**

## 一个模型长什么样

下面是我博客的文章模型，注意它既是数据结构定义，又是 TS 类型：

```ts
@plugin(AutoIncrementID, { field: 'id', startAt: 1 })
@index({ title: 'text', description: 'text' })
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

  @prop({ required: true })
  content: string

  @prop({ default: '', maxlength: 255 })
  description: string

  @prop({ enum: ArticleStatus, default: ArticleStatus.Published, index: true })
  status: ArticleStatus
}
```

每个装饰器都在「同时」表达两件事：

- `@prop({ required: true, maxlength: 64 })` → 运行时 schema 校验 + 编译期 `title: string` 类型；
- `@prop({ enum: ArticleStatus })` → schema 限定枚举值 + 类型收窄到枚举；
- `@index(...)`、`@plugin(...)`、`@modelOptions(...)` → 索引、插件、集合名与时间戳策略。

## 用枚举表达状态，而不是裸数字

数据库里状态常常存成数字（省空间、好索引），但代码里直接写 `status === 2` 是灾难。我用枚举把「数字存储」和「语义可读」两端接起来：

```ts
export enum ArticleStatus {
  Published = 1,
  Draft = 2,
}

export enum ArticlePublic {
  Public = 1,
  Private = 2,
}
```

存的是 `1 / 2`，写的是 `ArticleStatus.Published`。再配合一个冻结的过滤常量，把「访客只能看已发布且公开」这条规则收敛到一处：

```ts
export const ARTICLE_GUEST_FILTER = Object.freeze({
  public: ArticlePublic.Public,
  status: ArticleStatus.Published,
})
```

任何面向访客的查询 `Object.assign(filter, ARTICLE_GUEST_FILTER)` 即可，规则只有一份，不会出现「这个接口忘了过滤草稿」的事故。

## 与 NestJS 的衔接

Typegoose 模型通过一个薄薄的 `InjectModel` 适配层注入到 service：

```ts
constructor(
  @InjectModel(Article) private readonly articleModel: Model<Article>,
  @InjectModel(Category) private readonly categoryModel: Model<Category>,
) {}
```

拿到的 `Model<Article>` 是带完整类型的，`.find()`、`.findOneAndUpdate()` 的查询条件和返回值都有类型提示。配合 `.lean()` 拿纯对象、`.exec()` 拿真正的 Promise，读起来和原生 Mongoose 一致，但全程类型安全。

## 几个实战经验

- **`versionKey: false`**：个人博客用不到乐观锁的 `__v`，关掉让文档更干净。
- **`timestamps` 重命名**：我统一用 `created_at / updated_at`（snake_case），和对外 JSON 风格一致，省掉一层字段映射。
- **`maxlength` 写在模型层**：和 DTO 的 `class-validator` 校验形成双保险——DTO 挡住绝大多数非法输入，模型层兜底防止绕过 API 的写入。
- **`@prop({ type: () => [Number] })`**：数组类型要用工厂函数显式声明元素类型，否则运行时拿不到泛型信息。

## 小结

Typegoose 的核心价值是「单一事实来源」：模型定义只写一遍，schema 和类型永远一致。加字段不会再出现「类型对了 schema 没改」或反过来的尴尬。对 NestJS 这种本来就重度依赖装饰器和类型的框架，它是几乎零摩擦的搭配。
