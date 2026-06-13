---
id: 12
title: Git 使用指南：从日常工作流到撤销与协作的常用命令
description: 一份按「日常提交 / 分支协作 / 撤销后悔药 / 远程同步」分组的 Git 实用指南，重点讲清各种「撤销」的区别，以及常用但容易混淆的命令。
cover: ""
category: 工具与效率
tags: [Git, 版本控制, 命令行]
created_date: 2015-12-21
status: published
public: true
star: false
---

Git 命令几百个，但日常用的就那二三十个。这篇按使用场景分组整理，重点把最容易混淆的「撤销操作」讲清楚。

## 日常工作流

```bash
git status              # 看当前状态（最常敲）
git add .               # 暂存所有改动；git add -p 可逐块选择
git commit -m "msg"     # 提交
git log --oneline -10   # 看最近 10 条提交
git diff                # 看未暂存的改动；git diff --staged 看已暂存的
```

## 分支与协作

```bash
git branch              # 列出本地分支
git switch -c feat/x    # 新建并切换分支（比 checkout -b 更语义化）
git switch main         # 切回 main
git merge feat/x        # 合并分支
git rebase main         # 把当前分支变基到 main（线性历史）
git branch -d feat/x    # 删除已合并分支
```

> merge vs rebase：`merge` 保留分叉历史、产生合并提交；`rebase` 把提交「搬」到目标分支后面，历史更线性。**已推送给别人的分支不要 rebase**，会改写历史导致协作混乱。

## 撤销「后悔药」（重点）

各种撤销最容易搞混，按「撤销什么」记：

```bash
# 撤销工作区改动（还没 add）——丢弃修改，慎用
git restore <file>

# 把已 add 的取消暂存（回到工作区）
git restore --staged <file>

# 改最后一次提交（消息或漏加的文件）——没推送前才安全
git commit --amend

# 撤销某次提交，但生成一个「反向提交」（安全，适合已推送）
git revert <commit>

# 重置到某个提交：
git reset --soft  <commit>   # 只移动 HEAD，改动留在暂存区
git reset --mixed <commit>   # 默认：改动留在工作区
git reset --hard  <commit>   # 连工作区一起重置（危险，会丢改动）
```

记忆要点：

- **revert** = 安全的「反做」，不改写历史，适合已经推送的提交；
- **reset** = 改写历史的「回退」，`--hard` 会丢工作区改动，只在本地未推送时用；
- 真的 reset --hard 误删了？多数情况能用 `git reflog` 找回丢失的提交。

## 远程同步

```bash
git remote -v               # 看远程地址
git fetch                   # 只拉取，不合并
git pull                    # = fetch + merge（拉并合）
git pull --rebase           # 拉并变基，避免无谓的合并提交
git push                    # 推送
git push -u origin feat/x   # 首次推送并建立追踪
```

## 暂存现场

```bash
git stash           # 把当前改动临时收起（去处理别的）
git stash pop       # 恢复并移除最近的 stash
git stash list      # 看暂存列表
```

切分支前有未提交的改动又不想提交，`git stash` 很救命。

## 几个实用配置

```bash
git config --global alias.co switch
git config --global alias.st status
git config --global pull.rebase true    # pull 默认走 rebase
git config --global init.defaultBranch main
```

## 小结

Git 日常 = `status/add/commit/diff` 四件套 + 分支协作 + 远程同步。最该花时间理清的是撤销：**revert 安全反做（已推送用它）、reset 改写历史（本地未推送才用，--hard 会丢改动）**，搞混这两个是新手翻车重灾区。误操作了先想到 `git reflog`。
