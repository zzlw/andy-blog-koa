/**
 * MySQL → MongoDB 数据迁移脚本
 *
 * 用法：
 *   MYSQL_HOST=127.0.0.1 MYSQL_PORT=13306 MYSQL_USER=root \
 *   MYSQL_PASSWORD=xxx MYSQL_DATABASE=andy_blog \
 *   MONGO_URI=mongodb://127.0.0.1:27017/andy_blog \
 *   pnpm migrate
 *
 * 特性：
 * - 幂等可重跑：按业务 id upsert
 * - 保留 MySQL 自增 id，并 seed Typegoose AutoIncrementID 计数器
 * - 跳过软删除行（deleted_at 非空）
 * - articleTag / articleAuthor 中间表折叠为 Article 文档内数组
 * - 结束输出 MySQL/Mongo 计数核对表
 */
import mysql from 'mysql2/promise'
import mongoose from 'mongoose'

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'andy_blog',
}
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/andy_blog'

type Row = Record<string, any>

interface CollectionPlan {
  /** MySQL 表名 */
  table: string
  /** Mongo 集合名 */
  collection: string
  /** AutoIncrementID 计数器使用的 modelName（Typegoose Class 名） */
  modelName: string
  /** 行转换器 */
  transform: (row: Row, context: MigrationContext) => Row
}

interface MigrationContext {
  articleTagMap: Map<number, number[]>
  articleAuthorMap: Map<number, number[]>
}

const baseFields = (row: Row) => ({
  id: row.id,
  created_at: row.created_at ?? new Date(),
  updated_at: row.updated_at ?? new Date(),
})

const PLANS: CollectionPlan[] = [
  {
    table: 'author',
    collection: 'authors',
    modelName: 'Author',
    transform: (row) => ({
      ...baseFields(row),
      name: row.name,
      avatar: row.avatar ?? '',
      email: row.email ?? '',
      description: row.description ?? '',
      role: row.auth ?? 8,
      password: row.password,
    }),
  },
  {
    table: 'category',
    collection: 'categories',
    modelName: 'Category',
    transform: (row) => ({
      ...baseFields(row),
      name: row.name,
      description: row.description ?? '',
      cover: row.cover ?? '',
    }),
  },
  {
    table: 'tag',
    collection: 'tags',
    modelName: 'Tag',
    transform: (row) => ({ ...baseFields(row), name: row.name }),
  },
  {
    table: 'friend',
    collection: 'friends',
    modelName: 'Friend',
    transform: (row) => ({
      ...baseFields(row),
      name: row.name,
      link: row.link,
      avatar: row.avatar ?? '',
    }),
  },
  {
    table: 'message',
    collection: 'messages',
    modelName: 'Message',
    transform: (row) => ({
      ...baseFields(row),
      nickname: row.nickname ?? '匿名',
      content: row.content,
    }),
  },
  {
    table: 'comment',
    collection: 'comments',
    modelName: 'Comment',
    transform: (row) => ({
      ...baseFields(row),
      article_id: row.article_id,
      parent_id: row.parent_id ?? 0,
      nickname: row.nickname,
      content: row.content,
      like: row.like ?? 0,
      email: row.email ?? '',
      website: row.website ?? '',
    }),
  },
  {
    table: 'article',
    collection: 'articles',
    modelName: 'Article',
    transform: (row, context) => ({
      ...baseFields(row),
      title: row.title,
      content: row.content,
      description: row.description ?? '',
      cover: row.cover ?? '',
      created_date: row.created_date ?? row.created_at ?? new Date(),
      category_id: row.category_id ?? null,
      tag_ids: context.articleTagMap.get(row.id) ?? [],
      author_ids: context.articleAuthorMap.get(row.id) ?? [],
      public: row.public ?? 1,
      status: row.status ?? 1,
      star: row.star ?? 1,
      like: row.like ?? 0,
      views: row.views ?? 0,
    }),
  },
]

async function loadRelationMap(
  db: mysql.Connection,
  table: string,
  childField: string,
): Promise<Map<number, number[]>> {
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT article_id, ${childField} FROM \`${table}\` WHERE deleted_at IS NULL`,
  )
  const map = new Map<number, number[]>()
  for (const row of rows) {
    const list = map.get(row.article_id) ?? []
    list.push(row[childField])
    map.set(row.article_id, list)
  }
  return map
}

async function main() {
  console.log('连接 MySQL ...', `${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}/${MYSQL_CONFIG.database}`)
  const db = await mysql.createConnection(MYSQL_CONFIG)
  console.log('连接 MongoDB ...', MONGO_URI)
  const mongo = await mongoose.createConnection(MONGO_URI).asPromise()

  const context: MigrationContext = {
    articleTagMap: await loadRelationMap(db, 'articleTag', 'tag_id'),
    articleAuthorMap: await loadRelationMap(db, 'articleAuthor', 'author_id'),
  }

  const report: Array<{ 表: string; MySQL: number; Mongo: number; 一致: string }> = []

  for (const plan of PLANS) {
    const [rows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT * FROM \`${plan.table}\` WHERE deleted_at IS NULL`,
    )
    const docs = rows.map((row) => plan.transform(row, context))
    const collection = mongo.collection(plan.collection)

    if (docs.length) {
      await collection.bulkWrite(
        docs.map((doc) => ({
          replaceOne: { filter: { id: doc.id }, replacement: doc, upsert: true },
        })),
      )
    }

    // seed 自增计数器：让新建数据从 max(id)+1 开始
    const maxId = docs.reduce((max, doc) => Math.max(max, doc.id ?? 0), 0)
    await mongo.collection('identitycounters').updateOne(
      { modelName: plan.modelName, field: 'id' },
      { $max: { count: maxId } },
      { upsert: true },
    )

    const mongoCount = await collection.countDocuments()
    report.push({
      表: `${plan.table} → ${plan.collection}`,
      MySQL: rows.length,
      Mongo: mongoCount,
      一致: rows.length === mongoCount ? 'yes' : 'CHECK!',
    })
  }

  console.table(report)
  await db.end()
  await mongo.close()
  console.log('迁移完成')
}

main().catch((error) => {
  console.error('迁移失败:', error)
  process.exit(1)
})
