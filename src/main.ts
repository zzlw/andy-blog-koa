import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger, ValidationPipe } from '@nestjs/common'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import fastifyMultipart from '@fastify/multipart'
import { AppModule } from './app.module'
import { APP_CONFIG } from './app.config'

/**
 * 注册优雅关闭：收到 SIGTERM/SIGINT 时主动 app.close()（会触发所有
 * onModuleDestroy / onApplicationShutdown 钩子），并用超时兜底强制退出。
 *
 * 不使用 app.enableShutdownHooks()：它注册的信号处理器一旦内部某个钩子
 * 卡住就永不退出，导致 nest --watch 旧进程杀不掉（端口被占 → EADDRINUSE），
 * 生产环境 docker stop 也会被 SIGKILL 硬杀。这里的超时保证一定能退出。
 */
function registerGracefulShutdown(app: NestFastifyApplication, timeoutMs = 5000) {
  const logger = new Logger('Shutdown')
  let shuttingDown = false

  const handle = (signal: NodeJS.Signals) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.log(`收到 ${signal}，开始关闭...`)

    const forceExit = setTimeout(() => {
      logger.error(`优雅关闭超时 ${timeoutMs}ms，强制退出`)
      process.exit(1)
    }, timeoutMs)
    forceExit.unref()

    app
      .close()
      .then(() => {
        logger.log('已优雅关闭')
        process.exit(0)
      })
      .catch((error) => {
        logger.error('关闭出错', error)
        process.exit(1)
      })
  }

  process.once('SIGTERM', () => handle('SIGTERM'))
  process.once('SIGINT', () => handle('SIGINT'))
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    cors: {
      origin: true,
      credentials: true,
      // @fastify/cors 默认仅放行 GET,HEAD,POST，需显式声明否则 PUT/DELETE 预检失败
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    },
  })

  await app.register(fastifyMultipart as any, {
    limits: {
      // 全局硬上限取最大类型（音频 30MB）；图片/附件等更小限额在各上传路由二次校验
      fileSize: APP_CONFIG.upload.maxFileSize,
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
  registerGracefulShutdown(app)

  await app.listen(APP_CONFIG.port, '0.0.0.0')
  new Logger('Bootstrap').log(
    `andy-blog-api running at http://0.0.0.0:${APP_CONFIG.port}/api [${APP_CONFIG.environment}]`,
  )
}

bootstrap()
