---
title: Nuxt 4 SSR runtimeConfig：浏览器与容器内网双地址
description: SSR 应用有两种「请求 API」的视角——服务端渲染时走容器内网，浏览器水合后走公网域名。用 Nuxt runtimeConfig 的 public / 私有分区优雅地表达这件事。
cover: ""
category: 前端工程
tags: [Nuxt, Vue, SSR, TypeScript]
created_date: 2026-04-09
status: published
public: true
star: false
---

SSR 框架有个新手常踩的坑：**「API 地址」其实有两个**。

- 服务端渲染（SSR）阶段，Node 进程在容器里跑，它访问后端应该走**容器内网**（如 `http://api:3000`），快且不出公网；
- 浏览器水合（hydration）后，客户端发的请求要走**公网域名**（如 `https://api.jiawen.live`），因为用户的浏览器进不了你的容器网络。

如果只配一个地址，必然有一端是错的。Nuxt 的 `runtimeConfig` 天生就是为这件事设计的。

## public 与私有分区

`runtimeConfig` 分两块：

- **`public`**：会被打进客户端 bundle，浏览器能读到——放公网 API 地址；
- **顶层（私有）**：只在服务端可见，不会泄露到浏览器——放容器内网地址。

我的博客前端在 compose 里是这样注入的：

```yaml
web:
  environment:
    # 浏览器侧走对外地址
    NUXT_PUBLIC_API_BASE: ${API_BASE_URL}            # https://api.jiawen.live
    # SSR 数据预取走容器内网
    NUXT_API_BASE_INTERNAL: http://api:3000
    NUXT_PUBLIC_STATIC_PATH: ${STATIC_PATH}
    NUXT_PUBLIC_AI_API_BASE: ${AI_API_BASE:-}
```

Nuxt 有个约定：环境变量名以 `NUXT_PUBLIC_` 开头会自动映射到 `runtimeConfig.public.*`，以 `NUXT_` 开头映射到私有顶层。所以上面的变量分别落到：

- `config.public.apiBase` = 公网地址（浏览器用）
- `config.apiBaseInternal` = 容器内网（服务端用）

## 在代码里选对地址

封装一个「取 base url」的辅助逻辑，按运行环境选：

```ts
export function useApiBase() {
  const config = useRuntimeConfig()
  // import.meta.server：SSR 阶段走内网；客户端走公网
  return import.meta.server ? config.apiBaseInternal : config.public.apiBase
}
```

`import.meta.server` 让同一份代码在两端各取所需：服务端预取数据时命中内网快路径，浏览器交互时命中公网域名。

## 为什么不把内网地址放 public

很关键的一点：**容器内网地址绝不能进 `public`**。一是它对浏览器毫无意义（`http://api:3000` 在用户机器上根本解析不了），二是会无谓泄露内部拓扑。私有分区保证它只活在服务端。

`STATIC_PATH`（静态资源 CDN 域名）和 `AI_API_BASE`（AI 对话服务地址）则相反，浏览器要直接用，所以放 `public`。其中 `AI_API_BASE` 还做了「留空即关闭」的设计——没配就不渲染 AI 浮窗，让这个功能可选。

## runtimeConfig vs 编译期常量

也许有人问：为什么不用 `.env` + 编译期替换？因为 `runtimeConfig` 是**运行时**读取的，意味着同一个构建产物（镜像）可以在不同环境用不同地址启动，不必为每个环境重新构建。这正是「一次构建、多处运行」的 12-factor 实践，对 Docker 部署尤其重要。

## 小结

SSR 的「双地址」本质是「服务端视角 ≠ 浏览器视角」。Nuxt 用 `runtimeConfig` 的 public / 私有分区把这件事表达得很干净：公网地址进 `public` 给浏览器，内网地址留私有给 SSR，用 `import.meta.server` 在代码里选边。再配合运行时读取，一个镜像跑遍所有环境。
