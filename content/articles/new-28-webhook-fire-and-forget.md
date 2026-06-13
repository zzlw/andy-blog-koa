---
title: webhook 的 fire-and-forget：别让同步拖垮主流程
description: 文章保存成功，就该立刻返回——同步到 AI 知识库这种「副作用」绝不该阻塞它，更不该因为下游挂了而让用户发不出文章。聊聊主流程与副作用的解耦原则。
cover: ""
category: 架构与工程实践
tags: [Webhook, 事件驱动, 架构, 性能]
created_date: 2026-06-06
status: published
public: true
star: false
---

「文章保存后同步到 AI 知识库」这种需求，最容易写出一种危险的代码：在保存逻辑里同步等 Webhook 发完、等下游返回成功，才算保存成功。看着很「严谨」，其实是给系统埋了颗雷。

## 反面教材

```ts
// ❌ 别这么写
async create(dto: CreateArticleDTO) {
  const article = await this.articleModel.create({ ...dto })
  await this.aiService.syncToKnowledgeBase(article)  // 同步等待，致命
  return article
}
```

问题在那个 `await`：

- **AI 服务慢，用户就跟着慢**：发文章的响应时间被下游拖累；
- **AI 服务挂了，文章就发不出去**：一个「锦上添花」的功能，硬生生变成了主流程的单点故障；
- **跨境网络抖一下，保存就失败**：把不可控的外部依赖塞进了核心写路径。

**主流程被一个副作用绑架了。**

## 正解：fire-and-forget

「同步到 AI」是副作用，不是主流程的一部分。它应该「发出去就不管」——成功最好，失败也绝不能影响文章保存：

```ts
// ✅ 主流程只管自己的事，副作用通过事件异步触发
async create(dto: CreateArticleDTO) {
  const article = await this.articleModel.create({ ...dto })
  this.eventEmitter.emit(EVENT_ARTICLE_CHANGED)
  this.eventEmitter.emit(EVENT_ARTICLE_UPSERTED, article.toObject())
  return article            // 立即返回，不等任何下游
}
```

`create` 只负责「把文章存进数据库」这一件主流程的事，然后**广播一个事件**就返回。监听这个事件的 Webhook 发送器在「主流程之外」异步去同步 AI，它的成败完全不回流到 `create`。

发送端也做了防御：

- **异步、不阻塞**：发 Webhook 不挡主流程；
- **失败不抛回主流程**：下游错误自己消化掉（记日志），不冒泡;
- **可禁用**：密钥未配置时整个同步关闭，本地开发不依赖 AI 服务；
- **有兜底**：万一某次同步丢了，另有全量重灌接口可手动补。

## 这是一个普适原则

「主流程 vs 副作用」的解耦不止用于这一处。判断标准很简单——问一句：

> **这件事失败了，用户的核心操作该不该失败？**

- 「文章存进数据库」失败 → 发文章必须失败（主流程）；
- 「同步到 AI」「发通知」「更新搜索索引」「打点统计」失败 → 发文章**不该**失败（副作用）。

凡是答案为「不该」的，都应该 fire-and-forget：用事件 / 消息队列 / `waitUntil` 之类的手段从主流程里剥离，让它们在旁路异步执行、独立失败、独立重试。

## 一致性怎么办

有人会担心：异步了，会不会出现「文章存了但 AI 没同步上」的不一致？会，短暂地。但这是**可接受的最终一致性**——AI 知识库晚几秒甚至偶尔漏一条，远比「发不出文章」轻。对这类副作用，我们要的是最终一致，不是强一致。再配一个兜底重灌接口，就足够稳。

## 小结

发 Webhook 同步 AI 是副作用，主流程（文章入库）绝不能为它阻塞、更不能为它失败。用事件把副作用从主流程剥离，做到 fire-and-forget：异步、失败不回流、可禁用、有兜底。判断法则就一句——「这件事失败了，用户的核心操作该不该跟着失败？」答案为否的，统统赶出主流程。
