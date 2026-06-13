---
id: 4
title: HomeBrew 食用指南：macOS 的包管理器怎么用才顺手
description: HomeBrew 是 Mac 上最常用的包管理器。一份涵盖安装、formula 与 cask 区别、常用命令、国内换源加速与维护清理的实用指南。
cover: ""
category: 工具与效率
tags: [macOS, HomeBrew, 命令行]
created_date: 2019-10-13
status: published
public: true
star: false
---

HomeBrew 是 macOS（也支持 Linux）上事实标准的包管理器，一句话概括它的价值：**用一条命令装好命令行工具和 GUI 应用，并统一管理升级与卸载**，告别到处下载安装包。

## 安装

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

装完注意它的提示——Apple Silicon（M 系列）的 brew 装在 `/opt/homebrew`，需要把它加进 PATH（安装脚本通常会提示你执行一条 `eval` 命令写进 `~/.zshrc`）。

## formula 与 cask 的区别

这是 brew 的核心概念：

- **formula**：命令行工具/库（如 `git`、`node`、`wget`），`brew install xxx`。
- **cask**：GUI 应用（如 `google-chrome`、`visual-studio-code`），`brew install --cask xxx`。

```bash
brew install node           # 装命令行工具
brew install --cask iterm2  # 装图形应用
```

## 常用命令

```bash
brew search node        # 搜索
brew install node       # 安装
brew uninstall node     # 卸载
brew list               # 已安装列表
brew info node          # 查看包信息
brew upgrade            # 升级所有可升级的包
brew upgrade node       # 只升级某个
brew outdated           # 看哪些有新版本
brew deps --tree node   # 查看依赖树
```

## 国内加速

默认源在境外，慢的话可换国内镜像（如清华 TUNA），把 `brew.git`、`homebrew-core` 等仓库的 remote 指向镜像并设置 `HOMEBREW_BOTTLE_DOMAIN`。各镜像站都有现成的一键脚本，照着它的说明配即可，能显著提速。

## 维护与清理

```bash
brew cleanup            # 清理旧版本与缓存，释放磁盘
brew cleanup -n         # 先预览会删什么（不实际删）
brew doctor             # 体检：诊断环境问题与冲突
brew autoremove         # 移除不再被依赖的孤立包
```

定期 `brew cleanup` 很有必要——旧版本和下载缓存会悄悄占用不少磁盘。

## 常见坑

- **M 芯片 PATH 没配**：装完 `brew` 命令找不到，多半是没把 `/opt/homebrew/bin` 加进 PATH。
- **升级把依赖也带新了**：`brew upgrade` 会升级依赖，偶尔导致某个工具行为变化；介意的话用 `brew pin <formula>` 锁版本。
- **权限问题**：别用 `sudo brew`——brew 设计上就不该用 root 跑，出问题先 `brew doctor`。

## 小结

HomeBrew 让 Mac 的软件安装统一、可管理。记住 formula（命令行）与 cask（GUI）的区别、常用 `install/upgrade/cleanup/doctor` 几条命令、国内换源提速，再定期清理，基本就用顺了。
