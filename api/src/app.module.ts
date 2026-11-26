import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD, APP_PIPE } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule } from '@nestjs/throttler'
import { ZodValidationPipe } from 'nestjs-zod'
import { RateLimitGuard } from './common/http/guards/rate-limit.guard.js'
import { envSchema } from './infrastructure/env/env.js'
import { EnvModule } from './infrastructure/env/env.module.js'
import { HealthModule } from './infrastructure/health/health.module.js'
import { AuthModule } from './modules/auth/auth.module.js'
import { FilesModule } from './modules/files/files.module.js'
import { InvitesModule } from './modules/invites/invites.module.js'
import { TeamsModule } from './modules/teams/teams.module.js'

@Module({
	imports: [
		EnvModule,
		ConfigModule.forRoot({
			isGlobal: true,
			validate: (env) => envSchema.parse(env),
		}),
		ThrottlerModule.forRoot([
			{
				name: 'short', // 5 req / 1s
				ttl: 1_000,
				limit: 5,
			},
			{
				name: 'medium', // 30 req / 10s
				ttl: 10_000,
				limit: 30,
			},
			{
				name: 'long', // 100 req / 1min
				ttl: 60_000,
				limit: 100,
			},
		]),
		ScheduleModule.forRoot(),
		HealthModule,
		AuthModule,
		TeamsModule,
		InvitesModule,
		FilesModule,
	],
	providers: [
		{
			provide: APP_GUARD,
			useClass: RateLimitGuard,
		},
		{
			provide: APP_PIPE,
			useClass: ZodValidationPipe,
		},
	],
})
export class AppModule {}
