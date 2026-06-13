---
id: 9
title: Vim 前端开发插件整理：补全、LSP、文件树与格式化
description: 把 Vim 调成趁手的前端编辑器，关键是几类插件：LSP 补全、语法高亮、文件树、模糊查找、格式化与 Git。整理一套实用配置思路与选型。
cover: ""
category: 工具与效率
tags: [Vim, 前端, 效率]
created_date: 2020-10-13
status: published
public: true
star: false
---

裸 Vim 写前端是够呛的——没补全、没类型提示、没格式化。但配上几类插件后，它能逼近 IDE 的体验且依然轻快。这篇整理把 Vim 调成前端编辑器需要的几类插件与选型思路。

## 插件管理器

先有个插件管理器。经典选 `vim-plug`（轻量、上手快）：

```vim
" ~/.vimrc
call plug#begin('~/.vim/plugged')
Plug 'neoclide/coc.nvim', {'branch': 'release'}   " LSP 补全
Plug 'preservim/nerdtree'                          " 文件树
Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
Plug 'junegunn/fzf.vim'                            " 模糊查找
Plug 'tpope/vim-fugitive'                          " Git
Plug 'tpope/vim-commentary'                        " 快速注释
Plug 'jiangmiao/auto-pairs'                        " 括号自动配对
call plug#end()
```

装完 `:PlugInstall`。

## LSP 补全：核心中的核心

前端体验的关键是 **LSP**（语言服务器），它提供智能补全、跳转定义、类型提示、诊断。`coc.nvim` 是 Vim 上最成熟的方案之一，且能直接复用 VSCode 的扩展生态：

```vim
" 安装语言服务（在 vim 里执行）
:CocInstall coc-tsserver coc-eslint coc-prettier coc-json coc-css
```

- `coc-tsserver`：JS/TS 智能补全与类型提示；
- `coc-eslint`：行内 lint；
- `coc-prettier`：格式化。

> 用 Neovim 的话，原生 LSP + `nvim-cmp` + `mason` 是更现代的组合，但 `coc.nvim` 胜在开箱即用、配置少。

## 文件树与模糊查找

- **NERDTree**：侧边栏文件树，`:NERDTreeToggle` 开关，适合浏览项目结构。
- **fzf**：模糊查找文件/内容，`:Files` 找文件、`:Rg` 全局搜内容——大项目里比文件树更快。

实践中我更依赖 fzf：知道文件名片段直接 `:Files` 几下就到，比展开文件树点击快得多。

## 格式化与 Git

- **prettier（经 coc-prettier）**：保存时自动格式化，配 `coc-settings.json` 开 `formatOnSave`。
- **vim-fugitive**：在 Vim 里跑 git（`:Git blame`、`:Git diff`），不用切出去。
- **vim-commentary**：`gcc` 注释当前行、`gc` 注释选区。

## 配置心智

1. **从少到多**：先装 LSP（coc）+ fzf 两件核心，用顺了再加；插件越多启动越慢、越难维护。
2. **LSP 优先**：智能补全和诊断的收益远大于花哨外观。
3. **键位映射要克制**：常用操作映射到顺手的键（如 `<leader>f` 触发 fzf），但别堆太多记不住。

## 小结

把 Vim 变成前端利器，核心是 LSP 补全（coc.nvim + coc-tsserver/eslint/prettier），辅以 fzf 模糊查找、NERDTree 文件树、fugitive 管 Git、commentary 注释。从核心插件起步、按需增加，既有 IDE 的智能，又保留 Vim 的轻快与「动作语言」。
