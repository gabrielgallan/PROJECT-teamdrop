import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { envSchema } from './env/env.js'
import { EnvModule } from './env/env.module.js'
import { AuthModule } from './http/auth/auth.module.js'
import { HttpMoodule } from './http/http.module.js'
import { WebSocketModule } from './websocket/websocket.module.js'

@Module({
	imports: [
		EnvModule,
		ConfigModule.forRoot({
			isGlobal: true,
			validate: (env) => envSchema.parse(env),
		}),
		HttpMoodule,
		AuthModule,
		WebSocketModule,
	],
})
export class AppModule {}
