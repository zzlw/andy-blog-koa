---
title: acme.sh + 阿里云 DNS-01：泛域名证书自动续期与 CDN 推送
description: 一张泛域名证书覆盖所有子域，DNS-01 验证签发，daemon 模式自动续期，续期后还自动推送到 CDN。讲清这套「签一次、永不操心」的 HTTPS 自动化，以及冷启动的鸡生蛋问题。
cover: ""
category: 云原生与交付
tags: [acme.sh, HTTPS, Nginx, 自动化]
created_date: 2026-06-05
status: published
public: true
star: false
---

HTTPS 证书 90 天到期，手动续是个迟早会忘的事。我的目标是「签一次、之后永不操心」。实现它的组合是 **acme.sh + 阿里云 DNS-01 + 一张泛域名证书**。

## 为什么用 DNS-01 + 泛域名

证书验证有两种方式：

- **HTTP-01**：往网站某路径放个文件让 CA 来访问。简单，但**签不了泛域名**，每个子域都得单独签。
- **DNS-01**：往 DNS 加一条 TXT 记录证明你拥有域名。能签 `*.example.com` 泛域名，一张证书覆盖所有子域。

我有 `jiawen.live`、`api.`、`admin.`、`static.` 好几个子域，泛域名证书一张全包，所以选 DNS-01。验证靠调用阿里云 DNS 的 API 自动加删 TXT 记录，全自动无需人工。

## daemon 模式：内置 cron 自动续期

acme 用一个独立容器，`daemon` 模式跑：

```yaml
acme:
  build: ./acme
  command: daemon
  environment:
    ACME_EMAIL: ${ACME_EMAIL}
    BASE_DOMAIN: ${BASE_DOMAIN}        # 签 BASE_DOMAIN + *.BASE_DOMAIN
    Ali_Key: ${ALI_KEY}               # acme.sh dns_ali 插件约定的变量名
    Ali_Secret: ${ALI_SECRET}
    STATIC_DOMAIN: ${STATIC_DOMAIN}
  volumes:
    - acme-data:/acme.sh              # 账户/续期状态持久化，删容器不丢
    - ./nginx/certs:/certs            # 证书安装目录，网关只读挂同一目录
```

daemon 模式自带 cron：**每天检查、到期前 30 天自动续期**。续期后做两件事：把新证书重装到网关证书目录、推送到 CDN 加速域名。整条链路无人值守。

注意 `acme-data` 卷——它存 acme.sh 的账户和续期配置，必须持久化，否则重建容器就丢了续期状态、得重新签。

## 续期后自动推 CDN

静态资源走 CDN（加速域名），CDN 也要装证书。传统做法是续期后手动去控制台传新证书——又是个会忘的事。acme.sh 支持「部署钩子」，续期成功自动把证书推到阿里云 CDN：

```sh
# deploy-cdn.sh（续期成功后由 acme 自动调用，也可手动触发）
acme.sh --deploy -d "$BASE_DOMAIN" --deploy-hook ali_cdn
```

于是「网关证书」和「CDN 证书」一起更新，彻底告别手动上传。

## 冷启动的「鸡生蛋」问题

这套流程有个启动悖论：**nginx 配了 443 + ssl，但首次部署时还没有证书，nginx 起不来；可证书又要等服务起来后才能签。** 死锁。

解法是先放一张**自签占位证书**让 nginx 能启动，再签真证书替换：

```bash
make cert-selfsigned   # 生成自签占位证书，解开「无证书 → 443 起不来」的死锁
make prod              # 起完整生产栈（此时用占位证书）
make cert-issue        # DNS-01 签发真证书
make prod-reload       # 平滑 reload，加载真证书
```

之后就交给 daemon 自动续期，网关每 6 小时自动 reload 让新证书生效，人不用再碰。

## 小结

「签一次、永不操心」的 HTTPS 自动化：DNS-01 验证签一张泛域名证书覆盖所有子域，acme daemon 内置 cron 到期前自动续，续期后自动重装网关 + 推送 CDN。记得持久化 acme 数据卷、用自签占位证书解开冷启动死锁。配好之后，证书这件事就从你的待办清单里永久消失了。
