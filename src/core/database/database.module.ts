import mongoose, { Connection } from 'mongoose'
import { Global, Module, Logger, OnApplicationShutdown, Inject } from '@nestjs/common'
import { APP_CONFIG } from '@/app.config'

export const DB_CONNECTION_TOKEN = 'DB_CONNECTION_TOKEN'

const logger = new Logger('DatabaseModule')

const databaseProvider = {
  provide: DB_CONNECTION_TOKEN,
  useFactory: async (): Promise<Connection> => {
    const connection = await mongoose
      .createConnection(APP_CONFIG.mongo.uri, {
        serverSelectionTimeoutMS: 10_000,
      })
      .asPromise()
    logger.log(`MongoDB connected: ${APP_CONFIG.mongo.uri}`)
    connection.on('error', (error) => logger.error('MongoDB error', error))
    return connection
  },
}

@Global()
@Module({
  providers: [databaseProvider],
  exports: [databaseProvider],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DB_CONNECTION_TOKEN) private readonly connection: Connection) {}

  async onApplicationShutdown() {
    await this.connection.close()
  }
}
