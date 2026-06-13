---
id: 13
title: 本地开发绕过跨域：从「关浏览器安全」到正确做法
description: 早年开发常用「带 --disable-web-security 启动 Chrome」来绕过跨域，但它治标且危险。讲清 CORS 到底是什么、为什么会跨域，以及本地开发的正确解法（代理 / 后端 CORS）。
cover: ""
category: 前端工程
tags: [CORS, 浏览器, 前端]
created_date: 2018-12-19
status: published
public: true
star: false
---

很多人第一次遇到跨域报错，搜到的「速效药」是带参数启动 Chrome 关掉同源策略：

```bash
# 仅供临时调试，切勿用日常浏览器这么开
open -n -a "Google Chrome" --args --disable-web-security --user-data-dir=/tmp/chrome-dev
```

它确实能让报错消失，但这是**治标且危险**的做法——等于把浏览器的安全防线整个拆了。这篇讲清楚跨域到底怎么回事，以及该怎么正确解决。

## 为什么会跨域

浏览器有**同源策略**：协议、域名、端口三者完全相同才算「同源」。当前端页面（如 `http://localhost:5173`）去请求另一个源的接口（如 `http://localhost:3000` 或 `https://api.example.com`），就是跨域。浏览器出于安全会拦下响应，于是你看到那条经典报错：

```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

注意：**请求其实发出去了、服务端也响应了**，是浏览器拦下了响应不给 JS 读。所以这是浏览器侧的安全机制，不是网络不通。

## 正确解法一：后端开启 CORS（推荐）

跨域的「钥匙」在服务端——由服务端通过响应头声明「我允许哪些源访问我」：

```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET,POST,PUT,DELETE
Access-Control-Allow-Headers: Content-Type,Authorization
Access-Control-Allow-Credentials: true
```

各框架都有现成中间件（Express 的 `cors`、NestJS 的 `app.enableCors()` 等）。开发环境允许本地源、生产环境精确白名单，这是最干净的做法。

> 注意：带凭据（cookie/Authorization）时，`Allow-Origin` 不能用 `*`，必须是具体源，且要配 `Allow-Credentials: true`。

## 正确解法二：开发服务器代理

如果暂时改不了后端，用前端构建工具的开发代理：浏览器只访问**同源**的开发服务器，由它在背后转发到真实后端，跨域问题在服务器之间不存在。

```ts
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
```

前端请求 `/api/xxx`（同源），Vite 转发到 `localhost:3000`，浏览器全程认为是同源，自然没有 CORS。

## 为什么不要关浏览器安全

`--disable-web-security` 的问题：

- 它只在**你自己机器**上生效，真实用户的浏览器不会关——线上照样跨域，等于没解决；
- 关掉同源策略后，你浏览的任意网站都能读写彼此数据，安全风险极大；
- 容易养成「绕过」而非「理解」的习惯。

## 小结

跨域是浏览器同源策略的正常表现，不是 bug。正确解法是**后端声明 CORS 白名单**（首选）或**用开发服务器代理**让请求同源化。`--disable-web-security` 只是临时调试的下策，既治不了线上、又拆了浏览器安全，别把它当解决方案。
