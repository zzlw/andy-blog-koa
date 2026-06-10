# syntax=docker/dockerfile:1

# ---------- 基础层：corepack 启用 pnpm ----------
FROM node:22-slim AS base
RUN corepack enable pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./

# ---------- 开发层：热重载（docker-compose dev 使用 target: dev） ----------
FROM base AS dev
ENV NODE_ENV=development
RUN pnpm install
COPY . .
EXPOSE 3000 9229
CMD ["pnpm", "start:debug"]

# ---------- 构建层 ----------
FROM base AS builder
RUN pnpm install --frozen-lockfile || pnpm install
COPY . .
RUN pnpm build

# ---------- 生产依赖层 ----------
FROM base AS deps
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

# ---------- 运行层：仅 dist + 生产依赖，非 root 运行 ----------
FROM node:22-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

USER node
EXPOSE 3000
# 全部敏感配置（MONGO_URI/JWT_SECRET/七牛密钥）由运行时环境变量注入
CMD ["node", "dist/main.js"]
