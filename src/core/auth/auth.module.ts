import { Global, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { APP_CONFIG } from '@/app.config'
import { TokenService } from './token.service'

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: APP_CONFIG.auth.jwtSecret,
    }),
  ],
  providers: [TokenService],
  exports: [TokenService],
})
export class AuthCoreModule {}
