import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger, ValidationPipe } from '@nestjs/common'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import fastifyMultipart from '@fastify/multipart'
import { AppModule } from './app.module'
import { APP_CONFIG } from './app.config'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    cors: {
      origin: true,
      credentials: true,
    },
  })

  await app.register(fastifyMultipart as any, {
    limits: {
      fileSize: APP_CONFIG.upload.singleLimit,
      files: APP_CONFIG.upload.maxCount,
    },
  })

  app.setGlobalPrefix('api')
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      stopAtFirstError: false,
    }),
  )
  app.enableShutdownHooks()

  await app.listen(APP_CONFIG.port, '0.0.0.0')
  new Logger('Bootstrap').log(
    `andy-blog-api running at http://0.0.0.0:${APP_CONFIG.port}/api [${APP_CONFIG.environment}]`,
  )
}

bootstrap()
