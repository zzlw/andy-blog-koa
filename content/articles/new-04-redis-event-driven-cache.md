---
title: Redis 归档缓存的事件驱动失效：EventEmitter2 + TTL 兜底
description: 博客归档页「按年份分组的全部文章」读多写少，适合缓存。但缓存怎么失效才能既实时又稳？我用文章变更事件主动清缓存，再加一个 TTL 兜底，组合出一个稳妥的方案。
cover: ""
category: 后端工程
tags: [Redis, 缓存, 事件驱动, NestJS, 性能]
created_date: 2026-03-12
status: published
public: true
star: true
---

博客有个归档页：把所有已发布文章按年份分组，列出标题、封面、日期。这个数据有两个特点：**算一次不便宜**（要全表扫描 + 分组排序），**但几乎不变**（只有发文章时才变）。典型的「读多写少」，天生适合缓存。

真正的难点从来不是「怎么缓存」，而是「怎么让缓存失效」。

## 两种常见失效策略

**纯 TTL（按时间过期）**：给缓存设个过期时间，比如 5 分钟到点自动失效。简单，但有窗口期——刚发的文章要等几分钟才出现在归档页。对「内容一改就该可见」的场景体验不好。

**事件驱动（按变更失效）**：数据一变就主动把缓存删掉，下次访问重建。实时性最好，但要求「所有写入路径都记得清缓存」，漏一个就脏。

我的选择是**以事件驱动为主、TTL 兜底**，两者取长补短。

## 实现

归档服务读缓存、未命中则重建并写回，同时设一个 1 小时的兜底 TTL：

```ts
const ARCHIVE_CACHE_KEY = 'archive'
const ARCHIVE_CACHE_TTL = 60 * 60 // 1h 兜底过期；正常依赖事件失效

@Injectable()
export class ArchiveService {
  async getArchive(): Promise<ArchiveYear[]> {
    const cached = await this.cacheService.get<ArchiveYear[]>(ARCHIVE_CACHE_KEY)
    if (cached) return cached

    const archive = await this.buildArchive()
    await this.cacheService.set(ARCHIVE_CACHE_KEY, archive, ARCHIVE_CACHE_TTL)
    return archive
  }

  @OnEvent(EVENT_ARTICLE_CHANGED)
  async invalidate() {
    await this.cacheService.delete(ARCHIVE_CACHE_KEY)
  }
}
```

关键就是那个 `@OnEvent(EVENT_ARTICLE_CHANGED)`：它监听「文章变更」事件，一收到就删缓存。

## 事件从哪来

用 NestJS 的 `EventEmitter2`。文章 service 在创建、更新、删除时各发一枪：

```ts
async create(dto: CreateArticleDTO) {
  const article = await this.articleModel.create({ ...dto })
  this.eventEmitter.emit(EVENT_ARTICLE_CHANGED)
  this.eventEmitter.emit(EVENT_ARTICLE_UPSERTED, article.toObject())
  return article
}

async remove(id: number) {
  const result = await this.articleModel.deleteOne({ id }).exec()
  if (!result.deletedCount) throw new NotFoundException('文章不存在')
  this.eventEmitter.emit(EVENT_ARTICLE_CHANGED)
  this.eventEmitter.emit(EVENT_ARTICLE_DELETED, id)
}
```

注意这里发了**两类**事件：

- `EVENT_ARTICLE_CHANGED`：给归档缓存用，「有变化，请失效」；
- `EVENT_ARTICLE_UPSERTED / DELETED`：给 AI 知识库 Webhook 用，带上具体 payload 去同步向量库。

这正是事件驱动的威力——文章 service 完全不知道「谁在听」。它只负责宣布「文章变了」，归档缓存、AI 同步各自按需响应。以后再加一个「变更时发邮件订阅」也只是多一个监听者，写入逻辑一行都不用改。这就是**发布-订阅带来的解耦**。

## 为什么还要 TTL 兜底

事件驱动有个隐患：万一某条事件没触发（进程重启时序、未来某个绕过 service 的写入路径、监听器自身异常），缓存就可能「永远脏」下去。

那个 1 小时 TTL 就是保险丝：即使事件全丢了，缓存最迟 1 小时也会自然过期重建，不至于无限期错下去。正常情况下它几乎不会被触发——因为事件总是先一步把缓存清掉了。

「主动失效保证实时性，被动过期保证最终正确性」，两条腿走路才稳。

## 一点设计取舍

我没有做「精细化失效」（比如只更新归档里那一年的那一条），而是**整个归档缓存一把清掉、整体重建**。原因很简单：归档数据本身就不大，重建一次的成本远低于维护「增量更新」逻辑的复杂度和出错风险。**缓存失效宁可粗暴正确，不要精细易错**——这是个人项目里很实用的经验。

## 小结

读多写少的聚合数据用缓存，失效策略用「事件驱动为主 + TTL 兜底」：事件保证一改就生效，TTL 保证万一漏了也能自愈。再借 `EventEmitter2` 把「数据变了」这件事广播出去，缓存失效、AI 同步等下游各自订阅，写入方彻底解耦。
