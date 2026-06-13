---
title: 一套 Docker Compose 同时服务开发与生产：分层覆盖
description: 用三个 compose 文件——基础拓扑、开发覆盖、生产覆盖——让同一套服务定义既能本地一键热重载，又能生产一键带网关和证书部署。讲清分层覆盖的设计与取舍。
cover: ""
category: 云原生与交付
tags: [Docker, Docker Compose, 架构, CI-CD]
created_date: 2026-05-22
status: published
public: true
star: true
---

我的博客是个多服务系统：前台 SSR、后台 SPA、API、MongoDB、Redis，外加生产环境的 nginx 网关和证书服务。开发和生产的需求差异很大——开发要热重载、要暴露调试端口、用本地 MinIO；生产要常驻重启、统一网关、不暴露业务端口。

怎么用一套 compose 定义同时满足两者？答案是 **Compose 的分层覆盖（multiple `-f`）**。

## 三个文件，各管一层

```text
docker-compose.yml           # 基础：环境无关的服务拓扑
docker-compose.override.yml  # 开发：自动叠加
docker-compose.prod.yml      # 生产：显式 -f 指定
```

- **`docker-compose.yml`** 定义所有服务的「骨架」：镜像、网络、依赖关系、环境变量占位。它本身环境无关。
- **`docker-compose.override.yml`** 是开发增量。Compose 有个约定：`docker compose up` 会**自动叠加** override 文件。所以开发什么都不用加，直接 `up`。
- **`docker-compose.prod.yml`** 是生产增量，必须显式 `-f` 指定，避免误用。

## 开发覆盖：热重载 + 本地依赖

开发文件把服务从「拉镜像」改成「本地源码构建 + bind mount」，并暴露调试端口、起一个本地 MinIO 替代云存储：

```yaml
services:
  api:
    image: andy-blog-api:dev
    build:
      context: ../andy-blog-koa
      target: dev
    volumes:
      - ../andy-blog-koa:/app      # 源码挂载，改了即时生效
      - /app/node_modules          # 匿名卷隔离容器内依赖
    ports:
      - "3000:3000"
      - "9229:9229"                # Node 调试器

  minio:                            # 本地 S3，生产用 OSS/R2
    image: minio/minio:latest
    ports: ["9000:9000", "9001:9001"]
```

那个 `- /app/node_modules` 匿名卷是关键技巧：bind mount 会把宿主机目录整个盖上去，包括（可能为空或架构不符的）`node_modules`；用一个匿名卷「挡」在那个路径上，让容器用镜像里装好的依赖，宿主机和容器的依赖互不污染。

## 生产覆盖：常驻 + 网关 + 不暴露端口

生产文件给所有服务加 `restart: always`，并引入两个开发环境没有的服务——nginx 网关和 acme 证书：

```yaml
services:
  api:
    restart: always
    environment:
      NODE_ENV: production

  gateway:                          # 统一入口，业务容器不再直接暴露端口
    image: nginx:1.27-alpine
    ports: ["80:80", "443:443/tcp", "443:443/udp"]
    # ...

  acme:                             # 证书签发与自动续期
    build: ./acme
    command: daemon
```

注意生产里**业务容器不直接暴露端口**——全部流量经网关进出，更安全也更好管。

## 这套分层的价值

1. **一套真相，两种形态**：服务拓扑只定义一次，开发/生产只是它的两个「增量视图」，不会出现「开发能跑生产挂」的配置漂移。
2. **开发零心智负担**：`make dev` 背后就是 `docker compose up`，自动叠加 override，新人 clone 完即可启动。
3. **生产显式而安全**：生产组合必须显式 `-f docker-compose.yml -f docker-compose.prod.yml`，杜绝误把开发配置带上生产。
4. **环境差异集中可见**：想知道「开发和生产到底差在哪」，对比两个覆盖文件即可，一目了然。

## 配套的环境变量分层

compose 分层之外，env 也分层：`.env.development`（开发默认值）、`.env.production`（生产非敏感配置，入库）、`.env.production.local`（密钥，只存服务器、git 忽略）。两套分层配合，做到「配置可见、密钥隔离」。

## 小结

多服务系统不必为开发和生产各维护一套 compose。用「基础拓扑 + 开发覆盖（自动叠加）+ 生产覆盖（显式指定）」三层，让服务定义只有一份真相，开发热重载、生产带网关证书，各取所需，配置永不漂移。
