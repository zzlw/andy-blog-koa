import { createClient, RedisClientType } from 'redis'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { APP_CONFIG } from '@/app.config'

/**
 * Redis 缓存封装：统一命名空间与 JSON 序列化
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name)
  private readonly namespace = 'andy-blog'
  private client: RedisClientType

  async onModuleInit() {
    this.client = createClient({ url: APP_CONFIG.redis.uri })
    this.client.on('error', (error) => this.logger.error('Redis error', error))
    await this.client.connect()
    this.logger.log(`Redis connected: ${APP_CONFIG.redis.uri}`)
  }

  async onModuleDestroy() {
    await this.client?.quit()
  }

  private key(key: string): string {
    return `${this.namespace}:${key}`
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(this.key(key))
    return value ? (JSON.parse(value) as T) : null
  }

  /** @param ttl 过期时间（秒），缺省不过期 */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const payload = JSON.stringify(value)
    if (ttl) {
      await this.client.set(this.key(key), payload, { EX: ttl })
    } else {
      await this.client.set(this.key(key), payload)
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(this.key(key))
  }
}
