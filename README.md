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

## 数据同步到生产（mongodump / mongorestore）

```bash
# 本地导出（容器内执行）
docker exec andy-blog-mongo-1 mongodump --db andy_blog --archive --gzip > andy_blog.dump.gz

# 生产导入（--drop 先清空同名集合再恢复）
docker exec -i <prod-mongo-container> mongorestore --archive --gzip --drop < andy_blog.dump.gz
```

## 环境变量

| 变量 | 说明 |
|---|---|
| `PORT` | 服务端口，默认 3000 |
| `MONGO_URI` | MongoDB 连接串 |
| `REDIS_URI` | Redis 连接串 |
| `JWT_SECRET` | JWT 签名密钥 |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | 令牌过期秒数 |
| `S3_ENDPOINT` / `S3_REGION` | S3 兼容存储地址与区域（AWS S3 / R2 / MinIO） |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | S3 访问凭证 |
| `S3_BUCKET` | 存储桶名称 |
| `S3_PUBLIC_URL` | 浏览器可达的资源基础地址（CDN 域名），以 `/` 结尾 |
| `S3_FORCE_PATH_STYLE` | 是否 path-style 访问，MinIO 需 `true`（默认），AWS 设 `false` |
