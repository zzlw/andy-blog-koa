# syntax=docker/dockerfile:1

# ---------- 基础层：只拷贝依赖清单，最大化利用构建缓存 ----------
FROM node:14-slim AS base
WORKDIR /app
COPY package.json package-lock.json* ./

# ---------- 开发层：完整依赖 + 热重载（docker-compose dev 使用 target: dev） ----------
FROM base AS dev
ENV NODE_ENV=development
# Dev Container 内需要 git（VS Code 源码管理）；生产 runner 层不安装
# 注：buster 已 EOL，软件源需切换到 archive.debian.org
RUN sed -i 's|deb.debian.org/debian-security|archive.debian.org/debian-security|g; s|deb.debian.org/debian|archive.debian.org/debian|g' /etc/apt/sources.list \
    && sed -i '/buster-updates/d' /etc/apt/sources.list \
    && apt-get update -o Acquire::Check-Valid-Until=false \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
RUN npm install
COPY . .
EXPOSE 3000 9229
CMD ["npm", "run", "start:dev"]

# ---------- 依赖层：仅安装生产依赖 ----------
FROM base AS deps
RUN npm install --production && npm cache clean --force

# ---------- 运行层：最小运行时镜像，不含任何构建工具与密钥 ----------
FROM node:14-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 以非 root 用户运行，降低容器逃逸风险
USER node

EXPOSE 3000
# 所有敏感配置（数据库、JWT、七牛密钥）均在运行时通过环境变量注入，
# 严禁通过 ARG/ENV 在构建期烧录进镜像层
CMD ["node", "app.js"]
