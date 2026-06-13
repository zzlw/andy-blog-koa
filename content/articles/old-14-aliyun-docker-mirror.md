---
id: 14
title: 阿里云容器镜像加速：配置 registry-mirrors 告别拉取超时
description: 国内拉 Docker Hub 镜像慢甚至超时，配一个阿里云镜像加速器即可。讲清加速器原理、daemon.json 配置与验证方式，以及它不加速私有仓库这点要注意。
cover: ""
category: 云原生与交付
tags: [Docker, 阿里云, 镜像加速]
created_date: 2021-11-18
status: published
public: true
star: false
---

在国内直接 `docker pull` 官方镜像，经常慢得发指甚至超时。原因是 Docker Hub 的源在境外。解法是配一个**镜像加速器**——它是 Docker Hub 的国内只读缓存，把拉取流量导到就近节点。阿里云提供了免费的加速器。

## 原理

加速器（registry mirror）本质是 Docker Hub 的**镜像缓存代理**。配置后，`docker pull` 公共镜像时 Docker 守护进程会优先去加速器拉，命中缓存就快、没命中它再回源缓存下来。它只加速 Docker Hub 的**公共镜像**，不影响你拉私有仓库或其他 registry。

## 配置

在阿里云「容器镜像服务 → 镜像加速器」拿到你的专属地址（形如 `https://<id>.mirror.aliyuncs.com`），写进 Docker 守护进程配置：

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://<你的ID>.mirror.aliyuncs.com"]
}
EOF

sudo systemctl daemon-reload
sudo systemctl restart docker
```

macOS / Windows 的 Docker Desktop 则在「Settings → Docker Engine」的 JSON 里加同样的 `registry-mirrors` 字段，然后 Apply & Restart。

## 验证

```bash
docker info | grep -A1 "Registry Mirrors"
```

能看到你配的加速器地址即生效。再拉一个之前很慢的镜像感受速度：

```bash
time docker pull node:22-alpine
```

## 注意点

- **只加速公共镜像**：私有仓库、GHCR、自建 registry 不走加速器，该慢还是慢。
- **配错地址会静默回源**：加速器地址填错时 Docker 不一定报错，只是悄悄走原路（还是慢），所以要用 `docker info` 确认。
- **加速器也可能缓存延迟**：极新发布的 tag 偶尔加速器还没同步，可临时去掉加速器直连。
- **企业场景**：大量拉取建议配多个加速器或自建 pull-through cache，单一免费加速器有速率波动。

## 小结

国内 Docker 拉取慢，配阿里云 `registry-mirrors` 是最省事的解。改 `/etc/docker/daemon.json` 加加速器地址、重启 Docker、用 `docker info` 验证即可。记住它只加速 Docker Hub 公共镜像。
