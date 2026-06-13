# 内容导入脚本（import-content.ts）

把 `content/articles/*.md`（带 frontmatter 的 Markdown）通过 **Koa 管理 API** 幂等导入博客。
走正常管理接口，因此会自然触发**归档缓存失效**与 **AI 知识库 Webhook 同步**——无需任何额外手工操作。

## 工作流程

1. `POST /auth/login` 登录拿 access token
2. 读 `content/taxonomy.json`（若存在），确保其中分类/标签存在（缺则创建）
3. 逐篇解析 frontmatter，按**名称**解析 `category_id` / `tag_ids`（引用了 taxonomy 之外的名字会按需创建）
4. 幂等 upsert 文章：
   - frontmatter 带 `id` → `PUT /articles/:id`（更新旧文，保留 id 与点赞/浏览数）
   - 否则按 `title` 命中已有文章 → `PUT /articles/:id`（重复运行不会重建）
   - 否则 → `POST /articles`（新建）

## 运行（零额外依赖）

需要 Node ≥ 22.6（项目 `engines` 已要求 ≥22）。二选一：

```bash
# 方式一：Node 原生类型擦除直接运行
node --experimental-strip-types scripts/import-content.ts

# 方式二：经 ts-node（已在 devDependencies）
npx ts-node scripts/import-content.ts
```

## 环境变量

| 变量 | 必需 | 说明 |
|---|---|---|
| `API_BASE` | 是 | 管理 API 地址，如 `http://localhost:3000` |
| `ADMIN_NAME` | 是 | 管理员用户名 |
| `ADMIN_PASSWORD` | 是 | 管理员密码 |
| `CONTENT_DIR` | 否 | Markdown 目录，默认 `./content/articles` |
| `TAXONOMY_FILE` | 否 | 分类体系文件，默认 `./content/taxonomy.json` |
| `DRY_RUN` | 否 | `=1` 时只解析与打印计划、不发请求（离线校验内容用，凭证可缺省） |

> 凭证仅在运行期通过环境变量传入，**不写入任何文件、不提交**。

## 用法示例

```bash
# 先离线校验所有 md 与 taxonomy 能否正确解析
DRY_RUN=1 node --experimental-strip-types scripts/import-content.ts

# 正式导入（本地）
API_BASE=http://localhost:3000 \
ADMIN_NAME=admin \
ADMIN_PASSWORD='your-password' \
node --experimental-strip-types scripts/import-content.ts
```

## frontmatter 字段

```yaml
---
title: 文章标题（≤64 字）
description: 摘要（≤255 字）
cover: ""
category: 后端工程          # 分类名（脚本解析为 category_id）
tags: [NestJS, TypeScript] # 标签名数组（解析为 tag_ids）
created_date: 2026-05-12    # 展示用发布日期
status: published           # published | draft
public: true                # true=公开 / false=私有
star: false                 # true=精选
# id: 123                   # 仅「更新旧文」时填：按此 id 走 PUT，保留点赞/浏览数
---
正文 Markdown…
```

字段到模型枚举的映射：`status` published→1 / draft→2；`public` true→1 / false→2；`star` true→2 / false→1。

## 幂等性说明

脚本可**重复运行**：已存在（按 `id` 或 `title` 命中）的文章走更新而非新建，因此重跑不会产生重复文章。新建后会把 `title→id` 记入内存索引，避免同一次运行内重复创建。
