---
title: 给博客做一个流式 AI 对话浮窗：SSE + 组合式函数
description: 在博客右下角加一个会「打字机式」吐字的 AI 助手。前端用 Server-Sent Events 接收流式响应，用一个 useAiChat 组合式函数收敛全部状态，匿名 token 存在 localStorage。
cover: ""
category: 前端工程
tags: [Vue, Nuxt, SSE, AI]
created_date: 2026-04-16
status: published
public: true
star: true
---

我给博客加了个浮在右下角的 AI 助手：点开就能问「这个博客的作者写过哪些关于 RAG 的文章」，它会一边检索一边「打字机式」地把答案流式吐出来。这篇讲前端这块怎么做。

## 为什么是 SSE 而不是 WebSocket

AI 对话的流式输出是**单向**的：服务端持续往客户端推 token，客户端不需要在流中途反向发消息。这种场景 **Server-Sent Events（SSE）** 比 WebSocket 更合适：

- 基于普通 HTTP，天然穿透代理和 CDN，不用升级协议；
- 浏览器原生支持，断线自动重连；
- 实现简单，服务端就是一个 `text/event-stream` 的响应。

后端（一个 Cloudflare Worker）以 SSE 流式返回，每个事件是一个 JSON，类型可能是 `text`（正文增量）、`tool_start` / `tool_end`（工具调用提示）、`done`、`error`。

## 用组合式函数收敛状态

我把对话的全部状态和逻辑塞进一个 `useAiChat` 组合式函数，组件只管渲染：

```ts
export function useAiChat() {
  const messages = ref<ChatMessage[]>([])
  const loading = ref(false)

  async function send(text: string) {
    messages.value.push({ role: 'user', content: text })
    const assistant = reactive({ role: 'assistant', content: '' })
    messages.value.push(assistant)
    loading.value = true

    const res = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Token': token.value },
      body: JSON.stringify({ message: text }),
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // 按 SSE 的 \n\n 分隔切出一个个事件，逐个解析、追加到 assistant.content
      buffer = drainEvents(buffer, (evt) => {
        if (evt.type === 'text') assistant.content += evt.content
      })
    }
    loading.value = false
  }

  return { messages, loading, send }
}
```

组件侧极薄——一个输入框、一个消息列表、把 `assistant.content` 用 markdown 渲染出来即可。状态、网络、流解析全在组合式函数里，可测、可复用。

## 匿名身份：localStorage 里的 token

访客不登录也能用。首次打开时向服务端要一个**匿名会话 token**，存进 `localStorage` 永不变动，之后每次请求带在 `X-Token` 头里：

```ts
const token = ref(localStorage.getItem('ai_chat_token') ?? '')
if (!token.value) {
  const { result } = await (await fetch(`${base}/chat/token`)).json()
  token.value = result.token
  localStorage.setItem('ai_chat_token', token.value)
}
```

服务端用这个 token 标识会话、串起历史消息、做按会话的限流——既不强迫用户登录，又能维持上下文。

## 流式读取的两个细节

1. **手动切事件**：`reader.read()` 返回的 chunk 边界和 SSE 事件边界不对齐，可能半个事件、可能好几个挤一起。要维护一个 `buffer`，按 `\n\n` 切出完整事件再解析，残缺的留到下一轮。
2. **`decode(value, { stream: true })`**：流式解码，避免一个多字节 UTF-8 字符被切在两个 chunk 之间而乱码——中文场景必须加。

## 体验上的小心思

- **打字机效果是「免费」的**：因为是真流式，token 到一个渲染一个，天然就有逐字出现的观感，不用假动画。
- **工具调用可视化**：收到 `tool_start` 事件时显示「正在检索知识库…」，让等待有反馈，而不是干等一团空白。
- **AI 浮窗可选**：地址留空（`AI_API_BASE` 未配）就整个不渲染，把它做成一个可插拔的增强功能。

## 小结

流式 AI 对话前端的三块拼图：用 SSE 接单向流、用组合式函数收敛状态与流解析、用 localStorage 里的匿名 token 维持会话。剩下的「打字机感」是真流式自带的福利。
