---
title: React 19 + Ant Design 5 后台：运行时配置注入（app-config.js）
description: 前端 SPA 怎么在「同一份构建产物」里适配不同环境的 API 地址？答案不是构建期替换，而是容器启动时把环境变量渲染进一个 app-config.js，挂到 window 上供运行时读取。
cover: ""
category: 前端工程
tags: [React, Ant Design, Vite, Docker]
created_date: 2026-04-30
status: published
public: true
star: false
---

我的博客后台是 React 19 + Ant Design 5 + Vite 的纯 SPA。一个绕不开的问题：**SPA 怎么知道该请求哪个 API 地址？** 开发环境是 `localhost:3000`，生产是 `api.jiawen.live`，还有个可选的 AI 服务地址。

很多人第一反应是 Vite 的 `import.meta.env` + `.env` 文件。但那是**构建期**注入——意味着每个环境都要重新 `build` 一次，构建产物和环境绑死了。这违背「一次构建、多处运行」的原则。

我的做法是**运行时注入**。

## 一个挂在 window 上的配置对象

`public/` 下放一个 `app-config.js`，开发时是默认值：

```js
// public/app-config.js
window.__APP_CONFIG__ = {
  apiBaseUrl: 'http://localhost:3000',
  staticPath: 'http://localhost:9000/andy-blog',
  aiApiBase: 'http://localhost:8787',
}
```

`index.html` 在加载主 bundle **之前**先引入它：

```html
<script src="/app-config.js"></script>
<script type="module" src="/src/main.tsx"></script>
```

应用里通过一个统一的 config 模块读取，带类型和兜底：

```ts
interface AppRuntimeConfig {
  apiBaseUrl: string
  staticPath: string
  aiApiBase: string
}

const runtime = (window as any).__APP_CONFIG__ ?? {}

export const CONFIG: AppRuntimeConfig = {
  apiBaseUrl: runtime.apiBaseUrl ?? '',
  staticPath: runtime.staticPath ?? '',
  aiApiBase: runtime.aiApiBase ?? '',
}

// 某个功能依赖某个地址是否配置，可据此决定是否渲染入口
export const isAiServiceEnabled = () => Boolean(CONFIG.aiApiBase)
```

业务代码一律读 `CONFIG.*`，永远不直接碰 `window.__APP_CONFIG__`，也不读 `import.meta.env`。

## 生产：容器启动时渲染

构建出来的镜像里，`app-config.js` 是一个**带占位符的模板**。容器启动时（nginx 镜像的 `docker-entrypoint.d/` 钩子）用 `envsubst` 把环境变量渲染进去：

```sh
# docker/30-render-app-config.sh
cat > /usr/share/nginx/html/app-config.js <<EOF
window.__APP_CONFIG__ = {
  apiBaseUrl: "${API_BASE_URL}",
  staticPath: "${STATIC_PATH}",
  aiApiBase: "${AI_API_BASE}",
};
EOF
```

于是同一个镜像，靠不同的环境变量，就能在 staging、生产、别人的自部署里跑出不同的配置——**镜像与环境彻底解耦**。

## 这套设计解决了什么

1. **一次构建、多处运行**：CI 只 build 一次，产物推到镜像仓库，所有环境拉同一个镜像，靠 env 区分。回滚也简单——重启容器换 env 即可，不用重新构建。
2. **配置可见、可改**：运维在服务器上看一眼 `app-config.js` 就知道当前连的哪个后端，必要时还能临时改。
3. **功能开关化**：像 `isAiServiceEnabled()` 这样，地址没配就不渲染对应入口，把可选功能优雅地藏起来。

## 注意点

- `app-config.js` 必须**不被缓存**或带版本，否则改了配置浏览器还读旧的（给它设 `Cache-Control: no-cache`）。
- 它在主 bundle 之前同步加载，所以 `CONFIG` 在应用初始化时就已就绪，不用处理「配置还没到」的异步态。
- 别把密钥放进去——它是公开可见的客户端文件，只放「本来就要暴露给浏览器」的地址类配置。

## 小结

SPA 的环境适配，构建期注入（`import.meta.env`）会把产物和环境绑死；运行时注入（`window.__APP_CONFIG__` + 启动时 `envsubst` 渲染）才能做到「一次构建、多处运行」。一个挂在 window 上的配置对象 + 一个启动钩子，就把镜像和环境干净地解了耦。
