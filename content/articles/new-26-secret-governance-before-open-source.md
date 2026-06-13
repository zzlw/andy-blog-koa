---
title: 开源前的密钥治理：gitleaks + 历史清理 + 凭证轮换
description: 把一个私有项目开源前，最怕的是密钥泄露。一次真实的「.env 里混进了云厂商 AccessKey」事故，复盘从扫描、历史清理到凭证轮换的完整处置，以及那条最反直觉的铁律。
cover: ""
category: 云原生与交付
tags: [安全, 开源, CI-CD, Git]
created_date: 2026-06-13
status: published
public: true
star: true
---

把几个一直私有的仓库开源时，我做的第一件事不是写 README，而是**密钥治理**。因为一旦推上公网，任何曾经提交过的密钥都等于公开。这篇复盘一次真实事故和完整的处置流程。

## 事故：开发用 env 里混进了真 AccessKey

准备开源部署仓库时，我在 `.env.development` 里发现一串阿里云 AccessKey（`LTAI5t8D...`）。它本该是「开发默认值」，却不知何时被填进了真实生产凭证，还**跟着提交进了 git 历史**。

这是个极典型的坑：开发配置文件被纳入版本控制，某次图方便填了真密钥，从此长在历史里。

## 三步处置

### 第一步：当前文件去敏

先把现有文件里的真凭证换成安全的本地默认值——开发环境本就该用本地 MinIO，不需要云凭证：

```bash
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=andy-blog
S3_FORCE_PATH_STYLE=true
```

### 第二步：清理 git 历史

只改当前文件不够——密钥还躺在历史 commit 里，`git log` 一翻就有。我用 orphan 分支把历史压成一个干净的初始提交，物理上抹掉旧历史：

```bash
git checkout --orphan clean_main      # 建一个没有历史的孤儿分支
git add -A
git commit -m "chore: initial public commit"
git branch -D main
git branch -m clean_main main
git push -f origin main               # 强推覆盖远程
git reflog expire --expire=now --all  # 清本地 reflog
git gc --prune=now                    # GC 掉悬空对象
```

之后再用 **gitleaks** 扫一遍，确认历史里再无密钥，并把它接进 CI 防复发：

```yaml
# .github/workflows/gitleaks.yml —— 每次 push 自动扫密钥
- uses: gitleaks/gitleaks-action@v2
```

### 第三步（最关键）：轮换凭证

这是最反直觉、也最重要的一条铁律：

> **凡是曾经进过版本控制的密钥，无论后来怎么清理，都必须当作已泄露来处理——去源头轮换它。**

为什么？因为你无法保证它没被复制走：

- 仓库可能被人 clone、fork 过，本地副本里仍有旧历史；
- CI、备份、镜像缓存里可能留有残影；
- 你的「清理干净了」只是「在你能看到的地方干净了」。

git 历史清理消除的是**继续暴露**，但消除不了**已经发生过的暴露**。唯一能让旧密钥彻底失效的办法，是去阿里云控制台**禁用旧 AccessKey、生成新的**。新密钥只存进 `.env.production.local`（git 忽略，只在服务器上）。

## 把规则固化，别靠记性

事后我做了几件「让同类问题不再发生」的事：

1. **`.env.development` 只放假值**，真密钥一律进 git 忽略的 `.local` 文件；
2. **gitleaks 进 CI**，每次 push 自动扫，把检测左移到提交时；
3. **env 分层固化**：可入库的非敏感配置 vs 绝不入库的密钥，物理分文件。

## 小结

开源前的密钥治理是三步：当前文件去敏、git 历史清理、**源头轮换凭证**。其中轮换最关键也最容易被省略——很多人清完历史就以为安全了。记住那条铁律：**进过版本控制的密钥就是泄露的密钥**，清理只防继续暴露，轮换才真正止血。最后用 gitleaks + env 分层把规则固化进流程，别靠人的记性。
