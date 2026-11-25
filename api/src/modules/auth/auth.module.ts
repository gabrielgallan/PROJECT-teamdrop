import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { CryptographyModule } from '../../common/cryptography/cryptography.module.js'
import { CacheModule } from '../../infrastructure/cache/cache.module.js'
import { DatabaseModule } from '../../infrastructure/database/database.module.js'
import { EnvModule } from '../../infrastructure/env/env.module.js'
import { EnvService } from '../../infrastructure/env/env.service.js'
import { GoogleOAuthService } from './oauth/google-oauth.service.js'
import { AuthController } from './presentation/auth.controller.js'
import { AccessTokenGuard } from './presentation/guards/access-token.guard.js'
import { AccessTokenService } from './services/access-token.service.js'
import { AuthService } from './services/auth.service.js'
import { DesktopTicketService } from './services/desktop-ticket.service.js'
import { SessionService } from './services/session.service.js'

@Module({
	imports: [
		EnvModule,
		DatabaseModule,
		CacheModule,
		CryptographyModule,
		JwtModule.registerAsync({
			imports: [EnvModule],
			inject: [EnvService],
			useFactory: (env: EnvService) => ({ secret: env.get('JWT_SECRET') }),
		}),
	],
	exports: [AuthService, GoogleOAuthService, AccessTokenService],
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
