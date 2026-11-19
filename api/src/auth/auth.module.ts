import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { CacheModule } from '../cache/cache.module.js'
import { DatabaseModule } from '../database/database.module.js'
import { EnvModule } from '../env/env.module.js'
import { EnvService } from '../env/env.service.js'
import { AccessTokenService } from './access-token.service.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { DesktopTicketService } from './desktop-ticket.service.js'
import { AccessTokenGuard } from './guards/access-token.guard.js'
import { GoogleOAuthService } from './oauth/google-oauth.service.js'
import { SessionService } from './session.service.js'

@Module({
	imports: [
		EnvModule,
		DatabaseModule,
		CacheModule,
		JwtModule.registerAsync({
			imports: [EnvModule],
			inject: [EnvService],
			useFactory: (env: EnvService) => ({ secret: env.get('JWT_SECRET') }),
		}),
	],
	exports: [GoogleOAuthService],
	providers: [
		GoogleOAuthService,
		DesktopTicketService,
		AccessTokenService,
		SessionService,
		AuthService,
		{ provide: APP_GUARD, useClass: AccessTokenGuard },
	],
	controllers: [AuthController],
})
export class AuthModule {}
