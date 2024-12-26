# 第一阶段（构建阶段）
FROM node:12-alpine

WORKDIR /app

COPY . /app

RUN npm i

EXPOSE 3000
CMD ["npm", "run", "start:prod"]