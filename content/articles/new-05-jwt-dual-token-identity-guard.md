---
title: JWT 双令牌：access/refresh 边界与 Identity 守卫设计
description: 用短命 access token + 长命 refresh token 兼顾安全与体验，再用一个「全局尽力解析、按需强制校验」的身份守卫，让公开接口也能识别登录态。这是我博客后端的鉴权骨架。
cover: ""
category: 后端工程
tags: [JWT, NestJS, 安全, Node.js]
created_date: 2026-03-19
status: published
public: true
star: false
---

鉴权是后端绕不开的一块。我的博客用的是经典的 **JWT 双令牌** + **一个全局身份守卫**。这套组合既保证了安全性，又让「公开接口也能知道你是谁」变得很自然。

## 为什么要双令牌

单 token 有个两难：

- 有效期设短 → 安全，但用户老掉线，体验差；
- 有效期设长 → 体验好，但 token 一旦泄露，攻击窗口很长。

双令牌把「身份凭证」和「续期凭证」拆开：

- **access token**：短命（如 1 小时），随每个请求带在 `Authorization` 头里，用来证明「我是谁」；
- **refresh token**：长命（如 30 天），只在 access 过期时用一次，用来「换一对新令牌」。

登录时一次性签发两个：

```ts
private issueTokens(uid: number, role: Author['role']) {
  return {
    access_token: this.tokenService.signAccessToken(uid, role),
    refresh_token: this.tokenService.signRefreshToken(uid, role),
  }
}
```

access 过期后，前端拿 refresh 调一个独立端点换新令牌——这个端点不走身份守卫，由 service 显式校验 refresh token：

```ts
@Post('refresh')
@SuccessMessage('刷新成功')
refresh(@Req() request: FastifyRequest) {
  const token = this.tokenService.extractFromHeader(request.headers.authorization)
  return this.authorService.refresh(token)
}
```

这样即便 access token 泄露，攻击者最多撑 1 小时；refresh token 因为只在续期时短暂出现、不随每个请求传输，暴露面小得多。

## Identity 守卫：尽力解析，按需强制

很多鉴权实现是「保护的接口才解析 token」。但博客有大量**公开但需要识别登录态**的场景：比如文章详情接口，访客访问要 `views + 1`，而作者自己预览不应该刷阅读量。

所以我的守卫是全局的，逻辑分两层：**对所有请求尽力解析身份，只对 `@Auth()` 标注的路由强制校验。**

```ts
canActivate(context: ExecutionContext): boolean {
  const request = context.switchToHttp().getRequest()
  const minRole = this.reflector.getAllAndOverride(AUTH_MIN_ROLE_KEY, [
    context.getHandler(),
    context.getClass(),
  ])
  const isProtected = minRole !== undefined
  const token = this.tokenService.extractFromHeader(request.headers?.authorization)

  if (!token) {
    if (isProtected) throw new AuthFailedException('请先登录')
    request.identity = GUEST_IDENTITY   // 公开路由：当游客
    return true
  }

  let identity: RequestIdentity
  try {
    const payload = this.tokenService.verify(token, TokenType.Access)
    identity = { type: IdentityType.Author, authorId: payload.uid, role: payload.role }
  } catch (error) {
    if (isProtected) throw error        // 受保护路由：坏 token 如实报错
    identity = GUEST_IDENTITY           // 公开路由：坏 token 也当游客
  }

  request.identity = identity

  if (isProtected && (identity.role ?? 0) < minRole) {
    throw new NoPermissionException()
  }
  return true
}
```

几个关键设计：

- **公开路由容忍坏 token**：带了过期/非法 token 访问公开接口，不报错，按游客处理。这让前端不必在访问公开页前先判断 token 是否有效。
- **受保护路由如实抛错**：`@Auth()` 的接口遇到坏 token 会抛出过期/非法异常，前端据此触发刷新或跳登录。
- **角色等级用数字比较**：`@Auth(AuthorRole.SUPER_ADMIN)` 表达「最低角色等级」，守卫用 `identity.role < minRole` 一行搞定权限分级。删文章要超管，发文章普通作者即可。

业务层拿身份只需一个 `@Identity()` 装饰器，干净利落：

```ts
@Get(':id')
detail(@Param('id', ParseIntPipe) id: number, @Identity() identity: RequestIdentity) {
  return this.articleService.detail(id, identity)
}
```

## 小结

双令牌解决「安全 vs 体验」的矛盾：access 短命降风险，refresh 长命保体验。全局 Identity 守卫则把「是否登录」从一个二元开关变成「尽力识别 + 按需强制」的连续光谱，让公开接口也能优雅地区分游客与作者。鉴权逻辑全部收敛在守卫与 token service 两处，controller 只用 `@Auth()` 和 `@Identity()` 表达意图。
