---
id: 15
title: React Hooks 快速尝鲜：useState / useEffect 与自定义 Hook
description: Hooks 让函数组件也能拥有状态与生命周期。一篇从 useState、useEffect 讲到依赖数组陷阱与自定义 Hook 复用逻辑的上手指南，附常见误区。
cover: ""
category: 前端工程
tags: [React, Hooks, 前端]
created_date: 2018-10-04
status: published
public: true
star: false
---

Hooks 是 React 的一次范式转变：函数组件从此也能拥有状态、副作用和生命周期，不必再写 class。这篇带你快速上手核心 Hooks，并避开几个最常见的坑。

## useState：给函数组件加状态

```jsx
function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

要点：

- `useState` 返回 `[值, 更新函数]`；更新函数会触发重渲染。
- 依赖**上一个状态**时用函数式更新，避免闭包拿到旧值：

```jsx
setCount(prev => prev + 1)   // 比 setCount(count + 1) 更安全
```

## useEffect：处理副作用

数据请求、订阅、手动操作 DOM 这类「渲染之外」的事都放 `useEffect`：

```jsx
useEffect(() => {
  const id = setInterval(() => tick(), 1000)
  return () => clearInterval(id)   // 清理函数：组件卸载/依赖变更前执行
}, [])   // 依赖数组
```

**依赖数组**是 `useEffect` 的灵魂，也是最大的坑：

- `[]`：只在挂载时跑一次（类似 `componentDidMount`）；
- `[a, b]`：`a` 或 `b` 变化时重新跑；
- 不传：**每次渲染都跑**（通常是 bug）。

> 经验：effect 里用到的外部变量，原则上都该进依赖数组。漏写会导致「拿到过期的值」；用 ESLint 的 `react-hooks/exhaustive-deps` 规则兜底。

## 自定义 Hook：复用逻辑

Hooks 真正的威力是**抽取可复用的有状态逻辑**。约定以 `use` 开头：

```jsx
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

// 任意组件里复用
function Banner() {
  const width = useWindowWidth()
  return <div>{width < 768 ? '移动端' : '桌面端'}</div>
}
```

以前用高阶组件（HOC）、render props 才能复用的逻辑，现在一个自定义 Hook 就搞定，而且没有嵌套地狱。

## 常见误区

1. **在条件/循环里调用 Hook**：Hooks 必须在组件顶层无条件调用，顺序不能变（React 靠调用顺序识别 state）。
2. **依赖数组漏项**：导致闭包陷阱，拿到旧 state/props。
3. **在 effect 里直接改 state 不加依赖**：容易死循环（改 state → 重渲染 → effect 再跑）。
4. **把所有状态塞一个 useState 对象**：拆成多个独立 `useState` 通常更清晰。

## 小结

`useState` 加状态、`useEffect` 管副作用（重点是依赖数组）、自定义 Hook 复用逻辑——掌握这三件就能写出地道的函数组件。最大的坑永远是依赖数组，配合 `exhaustive-deps` lint 规则能省掉很多 debug 时间。
