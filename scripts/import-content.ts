/**
 * 幂等内容导入脚本
 * ---------------------------------------------------------------------------
 * 把 content/articles/*.md（带 frontmatter）通过 Koa 管理 API 导入博客：
 *   1. 登录拿 access token
 *   2. 读 content/taxonomy.json（若存在），确保其中的分类/标签存在
 *   3. 逐篇解析 frontmatter，按名称解析 category_id / tag_ids
 *   4. 幂等 upsert 文章：
 *        - frontmatter 带 id        → PUT  /articles/:id（更新旧文，保留 id/like/views）
 *        - 否则按 title 命中已有文章 → PUT  /articles/:id（重复运行不重建）
 *        - 否则                     → POST /articles（新建）
 *
 * 走的是正常管理 API，因此会自然触发：归档缓存失效 + AI 知识库 Webhook 同步。
 *
 * 运行（二选一，零额外依赖）：
 *   Node ≥ 22.6：  node --experimental-strip-types scripts/import-content.ts
 *   或经 ts-node： npx ts-node scripts/import-content.ts
 *
 * 必需环境变量（仅运行期传入，不写文件、不入库）：
 *   API_BASE        管理 API 地址，如 http://localhost:3000
 *   ADMIN_NAME      管理员用户名
 *   ADMIN_PASSWORD  管理员密码
 *
 * 可选：
 *   CONTENT_DIR     Markdown 目录，默认 ./content/articles
 *   TAXONOMY_FILE   分类体系文件，默认 ./content/taxonomy.json
 *   DRY_RUN=1       只解析与打印计划，不发起任何写请求
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

// 与 article.model.ts 的枚举保持一致（避免 TS enum，便于 --experimental-strip-types 直接运行）
const ARTICLE_PUBLIC = { public: 1, private: 2 } as const
const ARTICLE_STATUS = { published: 1, draft: 2 } as const
const ARTICLE_STAR = { normal: 1, star: 2 } as const

interface Frontmatter {
  title: string
  description?: string
  cover?: string
  category?: string
  tags?: string[]
  created_date?: string
  status?: string
  public?: boolean
  star?: boolean
  id?: number
}

interface ParsedArticle {
  frontmatter: Frontmatter
  content: string
  file: string
}

const DRY_RUN = process.env.DRY_RUN === '1'
const API_BASE = (required('API_BASE') ?? '').replace(/\/$/, '')
const ADMIN_NAME = required('ADMIN_NAME') ?? ''
const ADMIN_PASSWORD = required('ADMIN_PASSWORD') ?? ''
const CONTENT_DIR = resolve(process.env.CONTENT_DIR ?? './content/articles')
const TAXONOMY_FILE = resolve(process.env.TAXONOMY_FILE ?? './content/taxonomy.json')

/** 必需环境变量；DRY_RUN 下不写任何请求，故凭证可缺省（仅用于离线校验内容） */
function required(name: string): string | undefined {
  const value = process.env[name]
  if (!value && !DRY_RUN) {
    console.error(`缺少必需环境变量：${name}`)
    process.exit(1)
  }
  return value
}

/** 极简 frontmatter 解析：仅覆盖本项目受控的字段格式（key: value / [a, b] / 布尔 / 引号） */
function parseMarkdown(raw: string, file: string): ParsedArticle {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(raw)
  if (!match) throw new Error(`${file}: 缺少 frontmatter`)
  const [, head, body] = match

  const fm: Record<string, unknown> = {}
  for (const line of head.split('\n')) {
    const kv = /^([a-zA-Z_]+):\s*(.*)$/.exec(line)
    if (!kv) continue
    const [, key, rawValue] = kv
    fm[key] = parseValue(rawValue.trim())
  }

  if (!fm.title) throw new Error(`${file}: frontmatter 缺少 title`)
  return { frontmatter: fm as unknown as Frontmatter, content: body.trim(), file }
}

function parseValue(value: string): unknown {
  if (value === '') return ''
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => unquote(item.trim()))
      .filter((item) => item.length > 0)
  }
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+$/.test(value)) return Number(value)
  return unquote(value)
}

function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}

interface Envelope<T> {
  status: string
  message: string
  result: T
}

let accessToken = ''

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let parsed: Envelope<T> | undefined
  try {
    parsed = text ? (JSON.parse(text) as Envelope<T>) : undefined
  } catch {
    /* 非 JSON 响应 */
  }
  if (!res.ok) {
    const msg = parsed?.message ?? text ?? res.statusText
    throw new Error(`${method} ${path} → ${res.status} ${msg}`)
  }
  return (parsed?.result ?? (parsed as unknown)) as T
}

async function login(): Promise<void> {
  const result = await api<{ access_token: string }>('POST', '/auth/login', {
    name: ADMIN_NAME,
    password: ADMIN_PASSWORD,
  })
  accessToken = result.access_token
  if (!accessToken) throw new Error('登录未返回 access_token')
  console.log('✓ 登录成功')
}

interface NamedEntity {
  id: number
  name: string
}

async function ensureCategories(
  taxonomy: { categories?: { name: string; description?: string }[] } | null,
): Promise<Map<string, number>> {
  const existing = DRY_RUN ? [] : await api<NamedEntity[]>('GET', '/categories')
  const map = new Map(existing.map((c) => [c.name, c.id]))

  for (const cat of taxonomy?.categories ?? []) {
    if (map.has(cat.name)) continue
    if (DRY_RUN) {
      console.log(`  [dry-run] 将创建分类「${cat.name}」`)
      map.set(cat.name, -1)
      continue
    }
    const created = await api<NamedEntity>('POST', '/categories', {
      name: cat.name,
      description: cat.description,
    })
    map.set(cat.name, created.id)
    console.log(`  + 创建分类「${cat.name}」(#${created.id})`)
  }
  return map
}

async function ensureTags(
  taxonomy: { tags?: string[] } | null,
): Promise<Map<string, number>> {
  const existing = DRY_RUN ? [] : await api<NamedEntity[]>('GET', '/tags')
  const map = new Map(existing.map((t) => [t.name, t.id]))

  for (const name of taxonomy?.tags ?? []) {
    if (map.has(name)) continue
    if (DRY_RUN) {
      console.log(`  [dry-run] 将创建标签「${name}」`)
      map.set(name, -1)
      continue
    }
    const created = await api<NamedEntity>('POST', '/tags', { name })
    map.set(name, created.id)
    console.log(`  + 创建标签「${name}」(#${created.id})`)
  }
  return map
}

/** 按需创建并返回 id（用于 frontmatter 引用了 taxonomy 之外的名字时兜底） */
async function resolveCategoryId(name: string, cache: Map<string, number>): Promise<number | undefined> {
  if (!name) return undefined
  if (cache.has(name)) return cache.get(name)
  if (DRY_RUN) {
    cache.set(name, -1)
    return -1
  }
  const created = await api<NamedEntity>('POST', '/categories', { name })
  cache.set(name, created.id)
  console.log(`  + 创建分类「${name}」(#${created.id})`)
  return created.id
}

async function resolveTagIds(names: string[], cache: Map<string, number>): Promise<number[]> {
  const ids: number[] = []
  for (const name of names) {
    if (!cache.has(name)) {
      if (DRY_RUN) {
        cache.set(name, -1)
      } else {
        const created = await api<NamedEntity>('POST', '/tags', { name })
        cache.set(name, created.id)
        console.log(`  + 创建标签「${name}」(#${created.id})`)
      }
    }
    ids.push(cache.get(name)!)
  }
  return ids
}

/** 预取全部文章，建 title → id 映射，支撑「按标题幂等」 */
async function fetchTitleIndex(): Promise<Map<string, number>> {
  const index = new Map<string, number>()
  let page = 1
  const pageSize = 100
  for (;;) {
    const result = await api<{ data: { id: number; title: string }[]; total: number }>(
      'GET',
      `/articles?page=${page}&page_size=${pageSize}`,
    )
    for (const a of result.data) index.set(a.title, a.id)
    if (page * pageSize >= result.total || result.data.length === 0) break
    page += 1
  }
  return index
}

function toPayload(fm: Frontmatter, content: string, categoryId?: number, tagIds: number[] = []) {
  const payload: Record<string, unknown> = {
    title: fm.title,
    content,
    description: fm.description ?? '',
    cover: fm.cover ?? '',
    status: ARTICLE_STATUS[(fm.status as keyof typeof ARTICLE_STATUS) ?? 'published'] ?? ARTICLE_STATUS.published,
    public: fm.public === false ? ARTICLE_PUBLIC.private : ARTICLE_PUBLIC.public,
    star: fm.star === true ? ARTICLE_STAR.star : ARTICLE_STAR.normal,
  }
  if (categoryId && categoryId > 0) payload.category_id = categoryId
  if (tagIds.some((id) => id > 0)) payload.tag_ids = tagIds.filter((id) => id > 0)
  if (fm.created_date) payload.created_date = new Date(fm.created_date).toISOString()
  return payload
}

async function main(): Promise<void> {
  if (!existsSync(CONTENT_DIR)) throw new Error(`内容目录不存在：${CONTENT_DIR}`)
  const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md')).sort()
  if (files.length === 0) throw new Error(`${CONTENT_DIR} 下没有 .md 文件`)

  const articles = files.map((f) => parseMarkdown(readFileSync(join(CONTENT_DIR, f), 'utf8'), f))
  console.log(`解析到 ${articles.length} 篇文章${DRY_RUN ? '（DRY_RUN：不写入）' : ''}`)

  const taxonomy = existsSync(TAXONOMY_FILE)
    ? (JSON.parse(readFileSync(TAXONOMY_FILE, 'utf8')) as Record<string, unknown>)
    : null

  if (!DRY_RUN) await login()

  console.log('同步分类/标签…')
  const categoryCache = await ensureCategories(taxonomy as any)
  const tagCache = await ensureTags(taxonomy as any)

  const titleIndex = DRY_RUN ? new Map<string, number>() : await fetchTitleIndex()

  let created = 0
  let updated = 0
  for (const { frontmatter: fm, content, file } of articles) {
    const categoryId = fm.category ? await resolveCategoryId(fm.category, categoryCache) : undefined
    const tagIds = fm.tags?.length ? await resolveTagIds(fm.tags, tagCache) : []
    const payload = toPayload(fm, content, categoryId, tagIds)

    const targetId = fm.id ?? titleIndex.get(fm.title)

    if (DRY_RUN) {
      console.log(`  [dry-run] ${targetId ? `更新 #${targetId}` : '新建'} ← ${file}`)
      continue
    }

    if (targetId) {
      await api('PUT', `/articles/${targetId}`, payload)
      updated += 1
      console.log(`  ~ 更新 #${targetId}「${fm.title}」`)
    } else {
      const article = await api<{ id: number }>('POST', '/articles', payload)
      titleIndex.set(fm.title, article.id)
      created += 1
      console.log(`  + 新建 #${article.id}「${fm.title}」`)
    }
  }

  console.log(`\n完成：新建 ${created} 篇，更新 ${updated} 篇。`)
}

main().catch((err) => {
  console.error('\n导入失败：', err instanceof Error ? err.message : err)
  process.exit(1)
})
