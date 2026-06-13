---
id: 1
title: Docker 快速上手：从镜像到容器的常用命令
description: 一份按「镜像 / 容器 / 网络与数据卷 / 清理」分组的 Docker 常用命令速查，配上每个动作的使用场景与易踩的坑，适合需要时随手翻。
cover: ""
category: 云原生与交付
tags: [Docker, 容器, 命令行]
created_date: 2022-12-08
status: published
public: true
star: true
---

Docker 把「应用 + 依赖 + 运行环境」打包成一个可移植的镜像，再以容器的形式运行。理解它只需抓住三个概念：**镜像（image）是只读模板，容器（container）是镜像的运行实例，仓库（registry）存放镜像**。下面按使用场景整理常用命令。

## 镜像

```bash
docker pull nginx:1.27-alpine     # 拉取镜像（带具体 tag，别用 latest）
docker images                     # 列出本地镜像
docker build -t myapp:1.0 .       # 用当前目录 Dockerfile 构建
docker rmi myapp:1.0              # 删除镜像
docker image prune -f             # 清理悬空（dangling）镜像
```

> 经验：生产镜像永远打**具体 tag**（如 commit sha 或版本号），不要依赖 `latest`——否则「构建的、推送的、部署的」可能不是同一个产物。

## 容器

```bash
docker run -d --name web -p 8080:80 nginx   # 后台运行并映射端口
docker ps            # 运行中的容器；加 -a 看全部（含已退出）
docker logs -f web   # 跟随查看日志
docker exec -it web sh   # 进入容器排查
docker stop web && docker rm web   # 停止并删除
```

`-d` 后台、`-it` 交互、`-p 宿主:容器` 端口映射、`--name` 起名——这四个参数覆盖了日常九成场景。

## 数据卷与网络

容器是「用完即弃」的，**有状态数据必须放卷**，否则删容器即丢：

```bash
docker volume create pgdata
docker run -d -v pgdata:/var/lib/postgresql/data postgres:16

docker network create app-net           # 自建网络，容器间用服务名互通
docker run -d --network app-net --name api myapi
```

同一自定义网络内，容器可直接用**容器名/服务名**互相访问（如 `api` 连 `mongo:27017`），不必暴露端口到宿主机。

## 清理（释放磁盘）

```bash
docker system df            # 看 Docker 占用了多少磁盘
docker container prune -f   # 删所有已停止容器
docker image prune -af      # 删所有未被使用的镜像（慎用 -a）
docker system prune -af --volumes   # 终极清理：含未用卷（极慎用）
```

## 常见坑

- **端口映射方向别写反**：`-p 8080:80` 是「宿主 8080 → 容器 80」，前宿主后容器。
- **改了代码容器没更新**：容器跑的是构建时的镜像，改代码要重新 `build` 再重启，或用 bind mount 挂源码做开发热重载。
- **磁盘被吃满**：长期不清理，悬空镜像和停止容器会堆积，定期 `docker system df` + `prune`。

掌握「镜像→容器→卷/网络→清理」这条主线，Docker 的日常使用就基本顺手了。
