---
id: 7
title: Nginx 基本使用：命令、配置结构与反向代理
description: Nginx 日常用得最多的就那几条命令和几段配置。一份涵盖启停/reload、配置结构、静态站点、反向代理与常见排查的速查。
cover: ""
category: 云原生与交付
tags: [Nginx, 命令行]
created_date: 2016-12-08
status: published
public: true
star: false
---

Nginx 是用得最广的 Web 服务器与反向代理。日常其实就围绕「几条命令 + 几段配置」打转，这篇把它们整理清楚。

## 常用命令

```bash
nginx                 # 启动
nginx -s reload       # 平滑重载配置（不中断现有连接，改完配置就用它）
nginx -s stop         # 快速停止
nginx -s quit         # 优雅停止（处理完现有请求再退）
nginx -t              # 校验配置语法（reload 前务必先测）
nginx -V              # 查看版本与编译参数
```

> 铁律：**改完配置先 `nginx -t`，通过再 `nginx -s reload`**。`reload` 是平滑的——旧连接照常处理完，新连接用新配置，服务不中断。

## 配置结构

主配置 `nginx.conf` 的层级是 `main → events → http → server → location`：

```nginx
http {
  server {
    listen 80;
    server_name example.com;

    location / {
      root /usr/share/nginx/html;   # 静态站点根目录
      index index.html;
      try_files $uri $uri/ /index.html;   # SPA 兜底到 index.html
    }
  }
}
```

实践上建议把每个站点拆成单独文件放进 `conf.d/` 或 `sites-available/`，主配置只 `include`，便于管理。

## 反向代理

把请求转发给后端服务（如 Node 应用）：

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:3000/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

那几个 `proxy_set_header` 很重要：不带的话后端拿到的客户端 IP、协议都会失真（看到的全是 Nginx 自己）。

## 常见排查

- **502 Bad Gateway**：后端没起或地址写错，先确认 `proxy_pass` 的目标活着。
- **404 但文件存在**：多半是 `root` / `try_files` 路径不对，或权限不足。
- **改配置不生效**：忘了 `reload`，或改错了文件（被另一个 `server` 块的 `server_name` 抢先匹配）。
- **静态资源 403**：Nginx 运行用户对 `root` 目录无读权限。

## 小结

Nginx 日常 = `-t` 校验 + `-s reload` 平滑重载 + 一段 `server/location` 配置。静态站点配 `root` + `try_files`，反向代理配 `proxy_pass` + 转发头。记住「改配置先测后重载」，能避开绝大多数翻车。
