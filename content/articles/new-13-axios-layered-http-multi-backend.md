---
title: axios 分层封装：多后端鉴权与 401 处理
description: 后台要同时访问主站 API 和独立的 AI 服务，两个后端鉴权方式、响应结构都不同。用「每个后端一个 axios 实例 + 拦截器」分层封装，把鉴权、信封解包、401 登出收敛到一处。
cover: ""
category: 前端工程
tags: [axios, React, TypeScript]
created_date: 2026-05-14
status: published
public: true
star: false
---

我的博客后台要和两个后端打交道：主站 API（NestJS）和一个独立的 AI 对话服务（Cloudflare Worker）。它们的地址不同、鉴权头不同、响应信封也不同。如果到处 `axios.get(...)` 再手动加 header、手动解包，重复代码和遗漏迟早出事。

正解是**分层封装：每个后端一个专属 axios 实例，公共逻辑塞进拦截器。**

## 每个后端一个实例

不同后端 = 不同 `baseURL` + 不同拦截器配置。各建一个实例，互不干扰：

```ts
// ai-http.ts —— 专给 AI 服务用的实例
const instance = axios.create({ baseURL: CONFIG.aiApiBase })

// 请求拦截器：自动带上管理端令牌
instance.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

主站 API 那个实例同理，但 `baseURL` 指向 `CONFIG.apiBaseUrl`，鉴权方式按它的约定来。两个实例各自封装各自的差异，调用方完全无感。

## 响应拦截器：解包 + 统一报错 + 401 处理

AI 服务返回的是一个统一信封 `{ status, message, result }`。响应拦截器负责「拆信封、抛业务错、处理鉴权失效」：

```ts
instance.interceptors.response.use(
  (response) => {
    const body = response.data as AiResponse
    if (body.status !== 'success') {
      message.error(body.message || '请求失败')
      return Promise.reject(body)
    }
    return body            // 统一返回信封，调用方拿 .result
  },
  (error) => {
    if (error.response?.status === 401) {
      // 令牌失效：清登录态 + 跳登录页，避免停在一个「点啥都 401」的坏页面
      clearAuth()
      redirectToLogin()
    }
    message.error(error.response?.data?.message || '网络异常')
    return Promise.reject(error)
  },
)
```

把它包成带类型的小 API，业务里调用极简：

```ts
export default {
  get: <T = any>(url: string, params?: object) =>
    instance.request({ method: 'get', url, params }) as Promise<AiResponse<T>>,
  delete: <T = any>(url: string) =>
    instance.request({ method: 'delete', url }) as Promise<AiResponse<T>>,
}
```

业务层：`const { result } = await aiHttp.get<ChatSession[]>('/admin/chat-sessions')`——鉴权、解包、报错、401 跳转，一个都不用操心。

## 为什么不共用一个实例

有人会想「一个实例 + 动态 baseURL 不就行了」。不行，因为两个后端的**横切逻辑不一样**：

- 鉴权头可能不同（一个 `Authorization: Bearer`，另一个也许是别的方案）；
- 响应信封结构、错误判定字段不同；
- 401 的处理时机和跳转目标可能不同。

把它们塞进一个实例，拦截器里就会出现一堆 `if (isAiBackend)` 的分支，越长越乱。**一个后端一个实例**让每份拦截器都专注、简单、好测。

## 401 的「兜底登出」很重要

最容易被忽略、体验影响最大的是 401 处理。令牌过期后如果不集中处理，用户会停在一个「点哪都失败、又没提示」的死页面。在响应拦截器里统一捕获 401 → 清登录态 → 跳登录页，把这个糟糕体验一次性堵死。这也呼应了一个排障教训：曾经因为某个跨服务调用返回了非 2xx，触发了误判登出——把「什么情况算鉴权失效」收敛到一处，才好统一推敲、避免误伤。

## 小结

面对多后端，别用一个万能 axios 硬扛。**一个后端一个实例**，请求拦截器管鉴权、响应拦截器管解包与报错、401 统一兜底登出。差异封在实例内部，业务层只看到一个类型友好的简单 API。
