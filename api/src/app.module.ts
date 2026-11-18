import { MiddlewareConsumer, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { envSchema } from './env/env.js'
import { EnvModule } from './env/env.module.js'
import { LoggingMiddleware } from './middlewares/logging/logging.middleware.js'

@Module({
	imports: [
		EnvModule,
		ConfigModule.forRoot({
			isGlobal: true,
			validate: (env) => envSchema.parse(env),
		}),
	],
	controllers: [],
	providers: [],
})
export class AppModule {
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(LoggingMiddleware).forRoutes('/api')
	}
}
