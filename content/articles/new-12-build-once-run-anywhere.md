---
title: 构建产物与环境解耦：一次构建、多处运行
description: 12-factor 的「一次构建、多处运行」说起来简单，落到前端镜像就是一个问题：配置该在构建期还是运行期注入？我用容器启动时 envsubst 渲染配置的方式，让一个镜像跑遍所有环境。
cover: ""
category: 前端工程
tags: [Docker, CI-CD, 架构]
created_date: 2026-05-07
status: published
public: true
star: false
---

12-factor 应用有一条原则：**严格分离 build、release、run 三个阶段**，构建产物本身不应包含任何环境相关的配置。说起来简单，但前端项目最容易违反它——因为太多教程教你把 `VITE_API_URL` 写进 `.env`，构建时替换进去。

那样做的后果是：产物和环境绑死了。staging 一个镜像、生产一个镜像，要部署到第四个环境就得再 build 一次。这篇讲我怎么让**一个镜像跑遍所有环境**。

## 问题：配置注入的时机

配置注入有两个时机：

| | 构建期注入 | 运行期注入 |
|---|---|---|
| 方式 | `import.meta.env` / 编译替换 | 启动时读环境变量 |
| 产物 | 每个环境一份 | 全环境共用一份 |
| 换配置 | 重新构建 | 重启容器 |
| 回滚 | 重新构建旧版 | 拉旧镜像换 env |

对要长期运维、要回滚、要被别人自部署的项目，**运行期注入**几乎总是更优。

## 模式：启动时 envsubst 渲染

我的前端镜像（基于 nginx）都遵循同一个模式：镜像里放一个**带占位符的配置模板**，利用官方 nginx 镜像的 `/docker-entrypoint.d/` 启动钩子，在容器启动时用 `envsubst` 把环境变量渲染进静态文件。

后台 SPA 渲染的是一个挂在 window 上的配置：

```sh
# 容器启动时执行，把 env 渲染进可被前端读取的 app-config.js
cat > /usr/share/nginx/html/app-config.js <<EOF
window.__APP_CONFIG__ = {
  apiBaseUrl: "${API_BASE_URL}",
  staticPath: "${STATIC_PATH}",
  aiApiBase: "${AI_API_BASE}",
};
EOF
```

同样的思路也用在 nginx 网关上——域名通过 `envsubst` 注入到 server 配置模板，但只替换名字含 `DOMAIN` 的变量，避免误伤 `$host`、`$scheme` 这类 nginx 内置变量：

```yaml
gateway:
  environment:
    BLOG_DOMAIN: ${BLOG_DOMAIN}
    API_DOMAIN: ${API_DOMAIN}
    NGINX_ENVSUBST_FILTER: "DOMAIN"   # 只替换含 DOMAIN 的变量
  volumes:
    - ./nginx/templates:/etc/nginx/templates:ro
```

整个技术栈（前台 SSR、后台 SPA、网关）共享同一条心智：**镜像是不可变的、环境无关的；配置在启动那一刻才注入。**

## 收益

1. **CI 只构建一次**：一次 `build` → 推镜像 → 所有环境拉同一个 tag。构建时间、产物体积、镜像层缓存全都受益。
2. **回滚是「换 tag」而不是「重 build」**：部署脚本把要跑的镜像 tag 写进环境文件，回滚只是指回旧 tag 重启，秒级完成，无需等构建。
3. **可复现、可移交**：别人 clone 仓库、填自己的环境变量、拉镜像就能跑起来，不用拿到你的 `.env` 再重新构建。
4. **配置透明**：服务器上看一眼渲染出的文件就知道当前连的什么，排障直观。

## 一个容易忽略的坑

运行期注入的配置文件（如 `app-config.js`）**绝不能被长期缓存**。否则你改了环境变量、重启了容器，用户浏览器还拿着旧的缓存配置。给它设 `Cache-Control: no-cache`，让浏览器每次校验。

## 小结

「一次构建、多处运行」对前端不是口号，落地点就是「配置注入推迟到运行期」。用容器启动钩子 + `envsubst` 把环境变量渲染进静态配置文件，让镜像保持不可变、环境无关——CI 更快、回滚更稳、移交更省心。
