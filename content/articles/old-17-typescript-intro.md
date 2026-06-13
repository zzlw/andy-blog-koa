---
id: 17
title: TypeScript 快速入门：类型系统的核心心智模型
description: TypeScript 不只是「给 JS 加类型」，它是一套结构化类型系统。从基础类型、接口、泛型到联合/交叉类型，建立写 TS 的核心心智，附 tsconfig 关键开关。
cover: ""
category: 前端工程
tags: [TypeScript, 前端]
created_date: 2019-12-27
status: published
public: true
star: false
---

TypeScript 是 JavaScript 的超类型——所有合法 JS 都是合法 TS，它在此之上加了一套**静态类型系统**。价值在于：把一部分运行时才会暴露的错误，提前到编码时就被编译器抓住。这篇帮你建立写 TS 的核心心智。

## 基础类型

```ts
let name: string = 'andy'
let age: number = 18
let active: boolean = true
let ids: number[] = [1, 2, 3]
let tuple: [string, number] = ['a', 1]   // 元组：定长定类型
let any1: unknown = fetchSomething()      // 优先用 unknown 而非 any
```

> 经验：尽量别用 `any`，它等于关掉类型检查。需要「任意类型」时优先 `unknown`——它强制你先收窄类型才能使用，更安全。

## interface 与 type

描述对象结构，两者大多数场景可互换：

```ts
interface User {
  id: number
  name: string
  email?: string          // 可选属性
  readonly createdAt: Date // 只读
}

type ID = number | string  // type 更擅长联合/交叉/工具类型
```

经验法则：**描述对象/类的形状用 `interface`（可声明合并、可被实现），需要联合、交叉、映射等类型运算用 `type`。**

## 泛型：类型的参数

泛型让函数/类型对「具体类型」保持通用，同时不丢类型信息：

```ts
function first<T>(arr: T[]): T | undefined {
  return arr[0]
}
first([1, 2, 3])      // 推断 T = number，返回 number | undefined
first(['a', 'b'])     // 推断 T = string
```

API 响应封装是泛型的经典场景：

```ts
interface ApiResponse<T> {
  status: 'success' | 'error'
  result: T
}
const res: ApiResponse<User[]> = await getUsers()
```

## 联合与收窄

联合类型 `A | B` 配合「类型收窄」是 TS 最常用的表达力：

```ts
function format(value: string | number): string {
  if (typeof value === 'number') return value.toFixed(2)  // 这里 value 被收窄为 number
  return value.trim()                                      // 这里是 string
}
```

编译器会根据 `typeof`、`in`、`instanceof` 等判断**自动收窄**类型，IDE 提示也随之精确。

## 结构化类型（鸭子类型）

TS 是**结构化类型**：只看「形状」是否兼容，不看名字。只要一个对象具备目标类型要求的所有属性，它就是兼容的——这点和 Java/C# 的名义类型不同，理解了它就理解了 TS 很多「为什么能赋值」的行为。

## tsconfig 关键开关

```jsonc
{
  "compilerOptions": {
    "strict": true,              // 一键开启所有严格检查，强烈建议
    "noUncheckedIndexedAccess": true, // 索引访问带 undefined，更安全
    "target": "ES2022",
    "module": "ESNext"
  }
}
```

`strict: true` 是写 TS 的底线——它打开 `strictNullChecks` 等一系列检查，能挡住大量 `undefined is not a function` 这类运行时错误。

## 小结

把 TS 当「带类型的 JS」会低估它。它的核心是一套结构化静态类型系统：基础类型打底、interface/type 描述结构、泛型保通用、联合 + 收窄表达分支。开 `strict`，少用 `any`，让编译器在你出错前就拦住你。
