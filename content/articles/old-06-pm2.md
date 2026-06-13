---
id: 6
title: PM2 基本使用：Node 进程的守护、日志与开机自启
description: PM2 是 Node 应用最常用的进程管理器，负责崩溃自动重启、多实例负载、日志管理与开机自启。一份常用命令 + ecosystem 配置 + 部署实践的速查。
cover: ""
category: 云原生与交付
tags: [Node.js, PM2, 进程管理]
created_date: 2017-12-13
status: published
public: true
star: false
---

直接 `node app.js` 跑生产是不行的——进程一崩就没了、关掉终端就停了、看日志也麻烦。**PM2** 解决的就是这些：进程守护、崩溃自动重启、多实例、日志聚合、开机自启。

## 常用命令

```bash
pm2 start app.js --name api      # 启动并命名
pm2 list                          # 查看所有进程状态
pm2 logs api                      # 实时日志（加 --lines 200 看更多）
pm2 restart api                   # 重启
pm2 reload api                    # 0 秒停机重载（cluster 模式下平滑）
pm2 stop api && pm2 delete api    # 停止并移除
pm2 monit                         # 实时 CPU/内存监控面板
```

`restart` 会真正重启进程（有短暂停机）；`reload` 在 cluster 模式下逐个替换实例，**零停机**——生产更新优先用 `reload`。

## ecosystem 配置文件

命令行参数多了难维护，用配置文件统一管理：

```js
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'api',
    script: './dist/main.js',
    instances: 'max',        // 按 CPU 核数起多实例
    exec_mode: 'cluster',    // cluster 模式：多实例负载 + 平滑 reload
    max_memory_restart: '500M',   // 内存超限自动重启，防泄漏拖垮机器
    env: { NODE_ENV: 'production', PORT: 3000 },
  }],
}
```

```bash
pm2 start ecosystem.config.js     # 一键按配置启动
```

`cluster` 模式利用多核、支持平滑 reload；`max_memory_restart` 是个很实用的兜底——内存泄漏时自动重启，避免单进程吃满内存。

## 开机自启

服务器重启后进程要能自动拉起：

```bash
pm2 startup        # 生成并提示执行一条 systemd 自启命令
pm2 save           # 保存当前进程列表，开机时按它恢复
```

记得改完进程列表后再 `pm2 save` 一次，否则重启恢复的是旧快照。

## 与容器化的取舍

如今很多部署改用 Docker + 编排（容器自带重启策略 `restart: always`、健康检查），PM2 的「进程守护」职责被容器接管。但在**单机直接跑 Node**、或容器内需要 cluster 多实例时，PM2 依然好用。两者不冲突：容器管「容器活没活」，PM2 管「容器内多实例与平滑重载」。

## 小结

PM2 用一组简单命令解决了 Node 生产运行的核心诉求：守护、重启、多实例、日志、自启。配置沉淀到 `ecosystem.config.js`，生产更新用 `reload` 求零停机，再用 `startup + save` 搞定开机自启。
