# andy-blog-api

jiawen.live 博客后端（NestJS 重写版，参考 [nodepress](https://github.com/surmon-china/nodepress) 架构）。

## 技术栈

- NestJS 11 + Fastify + TypeScript
- MongoDB（Typegoose，双 ID 体系：`_id` + 自增 `id`）
- Redis（归档聚合缓存，事件驱动失效）
- JWT 双令牌（access 1h / refresh 30d）+ Identity 守卫
- 统一响应 `{ status, message, result }` + 语义化错误码

## 开发

```bash
pnpm install
pnpm start:dev          # 需本地 MongoDB + Redis，或直接用 andy-blog-deploy 的 compose
pnpm test
```

推荐通过 [andy-blog-deploy](../andy-blog-deploy) 一键启动全栈：`make dev`。

## 数据迁移（MySQL → MongoDB）

```bash
MYSQL_HOST=127.0.0.1 MYSQL_PORT=13306 MYSQL_USER=root \
MYSQL_PASSWORD=xxx MYSQL_DATABASE=andy_blog \
MONGO_URI=mongodb://127.0.0.1:27017/andy_blog \
pnpm migrate
```

脚本幂等可重跑，保留原数字 id，结束输出计数核对表。

## 环境变量

| 变量 | 说明 |
|---|---|
| `PORT` | 服务端口，默认 3000 |
| `MONGO_URI` | MongoDB 连接串 |
| `REDIS_URI` | Redis 连接串 |
| `JWT_SECRET` | JWT 签名密钥 |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | 令牌过期秒数 |
| `QN_ACCESSKEY` / `QN_SECRETKEY` / `QN_BUCKET` / `QN_SITE_DOMAIN` | 七牛云上传配置 |
