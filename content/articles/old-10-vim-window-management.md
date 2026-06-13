---
id: 10
title: Vim 窗口管理：split、切换、缩放与标签页
description: 在一个 Vim 里同时看多个文件，靠的是窗口（split）、缓冲区（buffer）与标签页（tab）三个概念。讲清它们的区别与高频操作，把多文件编辑流盘顺。
cover: ""
category: 工具与效率
tags: [Vim, 效率, 命令行]
created_date: 2020-12-14
status: published
public: true
star: false
---

写代码常要同时看多个文件：左边实现、右边测试。Vim 的多文件编辑靠三个容易混淆的概念支撑——**buffer（缓冲区）、window（窗口）、tab（标签页）**。先理清它们，操作才不乱。

## 三个概念的关系

- **buffer**：一个被打开的文件在内存里的内容。打开 10 个文件就有 10 个 buffer，不管你看不看得见。
- **window**：buffer 的一个「视口」。split 出来的每一格都是一个 window，多个 window 可以看同一个 buffer。
- **tab**：一组 window 的布局集合。注意 Vim 的 tab **不是**「每个文件一个标签」（那是 VSCode 思维），而是「一套窗口排布」。

一句话：**buffer 是文件，window 是看它的窗，tab 是一组窗的布局。**

## 分屏（split）

```
:split    或 :sp     水平分屏（上下）
:vsplit   或 :vs     垂直分屏（左右）
:sp file            分屏并打开指定文件
Ctrl-w s / Ctrl-w v  快捷分屏（水平 / 垂直）
```

## 窗口间切换

所有窗口操作都以 `Ctrl-w` 开头：

```
Ctrl-w h/j/k/l    切到 左/下/上/右 的窗口
Ctrl-w w          循环切换窗口
Ctrl-w q          关闭当前窗口
Ctrl-w o          只保留当前窗口（关掉其它）
```

## 调整窗口大小

```
Ctrl-w =          所有窗口等宽等高
Ctrl-w _          当前窗口最大化高度
Ctrl-w |          当前窗口最大化宽度
Ctrl-w + / -      增高 / 减高
Ctrl-w < / >      减宽 / 增宽
:resize 20        设当前窗口高 20 行
```

## buffer 切换

不分屏、只在当前窗口切换打开的文件：

```
:ls 或 :buffers   列出所有 buffer
:b <n>           切到第 n 个 buffer
:bn / :bp        下一个 / 上一个 buffer
:bd              关闭当前 buffer
```

配合 fzf 的 `:Buffers` 可以模糊查找已开文件，比记编号快。

## 标签页（tab）

需要几套完全不同的布局时才用 tab：

```
:tabnew          新建标签页
gt / gT          下一个 / 上一个标签页
:tabclose        关闭当前标签页
```

> 提示：日常多文件用 **buffer + split** 就够了，tab 适合「这套窗口做功能 A、另一套做功能 B」的场景，别拿它当 VSCode 的文件标签用。

## 小结

记住「buffer=文件、window=视口、tab=布局」这条主线，多文件编辑就清晰了：`:vs` 分屏、`Ctrl-w + hjkl` 切窗、`Ctrl-w =/_/|` 调大小、`:b` 切 buffer。掌握这套，一个 Vim 窗口里也能流畅地多文件并行。
