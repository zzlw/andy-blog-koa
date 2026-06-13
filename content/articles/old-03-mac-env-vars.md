---
id: 3
title: macOS 环境变量配置：搞清 PATH 与各 shell 配置文件的加载顺序
description: 在 Mac 上配环境变量总是「这次生效下次又没了」？根因是没搞清不同 shell 的配置文件加载时机。讲清 PATH、zsh/bash 配置文件顺序与正确的持久化方式。
cover: ""
category: 工具与效率
tags: [macOS, 命令行, 环境配置]
created_date: 2018-05-22
status: published
public: true
star: false
---

在 Mac 上配环境变量，最常见的困惑是：`export` 完当时能用，开个新终端又没了；或者改了 `.bash_profile` 毫无反应。根因都是一个——**没搞清当前 shell 是谁、它读哪个配置文件、什么时候读**。

## 临时 vs 永久

```bash
export PATH="$HOME/bin:$PATH"   # 仅当前终端会话有效，关掉即失
```

`export` 只影响当前会话。要永久生效，必须写进 shell 的**启动配置文件**，每开终端自动加载。

## 关键：你用的是 zsh 还是 bash

macOS Catalina 起默认 shell 是 **zsh**。先确认：

```bash
echo $SHELL     # /bin/zsh 还是 /bin/bash
```

配置文件对应关系：

| Shell | 交互式登录加载 | 常用持久化文件 |
|---|---|---|
| zsh | `~/.zprofile` → `~/.zshrc` | **`~/.zshrc`** |
| bash | `~/.bash_profile` → `~/.bashrc` | `~/.bash_profile` |

**最常见的错误**：用着 zsh，却把变量写进 `.bash_profile`——当然不生效。zsh 用户写 `~/.zshrc` 就对了。

## 正确持久化

```bash
# 编辑 zsh 配置
vim ~/.zshrc

# 在文件末尾追加
export JAVA_HOME=/Library/Java/JavaVirtualMachines/...
export PATH="$JAVA_HOME/bin:$PATH"

# 立即生效（不用重开终端）
source ~/.zshrc
```

## 理解 PATH

`PATH` 是一串用冒号分隔的目录，shell 按**从左到右**的顺序在这些目录里找命令，**找到第一个就用**。所以：

```bash
export PATH="$HOME/bin:$PATH"   # 把自定义目录放前面 → 优先级更高
```

把目录放 `$PATH` 前面能覆盖系统同名命令（比如用自己装的新版 Python 覆盖系统自带）。查命令实际用的是哪个：

```bash
which python3      # 看最终解析到哪个路径
echo $PATH | tr ':' '\n'   # 把 PATH 拆行看清顺序
```

## 常见坑

- **写错文件**：zsh 用户改了 `.bash_profile`（见上）。
- **重复追加**：每次 `source` 又 `export` 一遍，PATH 越积越长。改完用 `echo $PATH` 检查有没有重复。
- **引号与空格**：路径含空格要加引号；`PATH` 赋值等号两边不能有空格。
- **GUI 应用读不到**：从 Finder 启动的 App 不走终端配置文件，需要别的机制（如 `launchctl`），这是另一个话题。

## 小结

Mac 配环境变量「不生效」十有八九是改错了文件。先 `echo $SHELL` 确认 shell，zsh 就写 `~/.zshrc`、bash 写 `~/.bash_profile`，改完 `source` 一下。理解 PATH「从左到右、取第一个」的查找规则，就能掌控命令优先级。
