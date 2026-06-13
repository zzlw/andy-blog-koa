---
id: 5
title: oh-my-zsh 疑难杂症与提速：插件、主题与启动慢排查
description: oh-my-zsh 好用但容易越配越慢、越配越乱。整理几个高频问题：启动变慢怎么定位、必装插件、主题与字体、以及配置丢失的排查。
cover: ""
category: 工具与效率
tags: [macOS, Zsh, 命令行]
created_date: 2021-06-30
status: published
public: true
star: false
---

oh-my-zsh 是 zsh 的配置框架，主题、插件、补全一应俱全，几乎是 Mac 终端的标配。但用久了常遇到两类问题：**启动越来越慢**和**配置莫名失效**。这篇整理几个高频疑难杂症。

## 必装的两个插件

oh-my-zsh 自带很多插件，但有两个第三方插件几乎人人会装：

```bash
# 命令自动建议（输入时灰色提示历史命令）
git clone https://github.com/zsh-users/zsh-autosuggestions \
  ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions

# 语法高亮（命令正确变绿、错误变红）
git clone https://github.com/zsh-users/zsh-syntax-highlighting \
  ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
```

在 `~/.zshrc` 启用：

```bash
plugins=(git z zsh-autosuggestions zsh-syntax-highlighting)
```

> 注意：`zsh-syntax-highlighting` 必须放在 `plugins` 列表的**最后**，否则高亮可能不生效。

## 启动变慢怎么排查

终端打开要等好几秒，通常是某个插件或主题（尤其需要查 git 状态的）拖慢的。定位方法：

```bash
# 给启动过程计时，看每一步耗时
time zsh -i -c exit

# 更细致：在 .zshrc 顶部加 zmodload zsh/zprof，底部加 zprof，重开终端看排名
```

常见元凶：

- **巨大的 git 仓库**：主题在每次显示提示符时查 git 状态，大仓库会很慢。可关掉主题的 git 状态或用更轻的主题。
- **nvm 加载慢**：`nvm` 的初始化脚本很重，可改为懒加载（用时再初始化）。
- **插件过多**：只留真正常用的，别什么都开。

## 主题与字体

热门主题如 `powerlevel10k`（极快、可配置）需要 **Nerd Font** 字体才能正确显示图标，否则会看到一堆乱码方块。装一个 Nerd Font 并在终端里设为默认字体即可。`p10k configure` 还能交互式定制外观。

## 配置「失效」排查

- **改了 .zshrc 没反应**：忘了 `source ~/.zshrc` 或重开终端。
- **插件命令找不到**：第三方插件没 clone 到 `$ZSH_CUSTOM/plugins/`，或 `plugins=()` 里名字拼错。
- **被 .zprofile 覆盖**：PATH 等在 `.zprofile` 和 `.zshrc` 都改了，注意加载顺序（`.zprofile` 先于 `.zshrc`）。
- **升级 oh-my-zsh 后异常**：`omz update` 后偶有插件不兼容，看报错定位具体插件。

## 小结

oh-my-zsh 的两大常见病是「启动慢」和「配置失效」。慢就用 `time zsh -i -c exit` / `zprof` 定位元凶（多为 git 状态、nvm、插件过多），失效多半是没 source、插件没装好或加载顺序问题。装上 autosuggestions + syntax-highlighting，配个 Nerd Font + 轻主题，终端体验立竿见影。
