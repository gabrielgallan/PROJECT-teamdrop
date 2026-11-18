import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { envSchema } from './env/env.js'
import { EnvModule } from './env/env.module.js'
import { HttpMoodule } from './http/http.module.js'

@Module({
	imports: [
		EnvModule,
		ConfigModule.forRoot({
			isGlobal: true,
			validate: (env) => envSchema.parse(env),
		}),
		HttpMoodule
	],
})
export class AppModule {}
