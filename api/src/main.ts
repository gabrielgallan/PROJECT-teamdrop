import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module.js'
import { EnvService } from './common/env/env.service.js'
import { configureSwagger } from './config/swagger.config.js'

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		logger: ['error', 'log', 'warn', 'verbose', 'debug'],
		rawBody: true,
	})

	const env = app.get(EnvService)
	const logger = new Logger()
	const port = env.get('PORT')

	app.enableCors({
		origin: (origin: string, callback: any) => {
			if (!origin) return callback(null, true)

			const allowedOrigins = env.get('CORS_ORIGINS').split(',')

			if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
				callback(null, true)
			} else {
				callback(new Error('Not allowed by CORS'))
			}
		},
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
		credentials: true,
		maxAge: 86400,
	})

	configureSwagger(app)

	app
		.listen(port)
		.catch((error) => {
			logger.error('Error starting HTTP server', error)

			process.exit(1)
		})
		.finally(async () => {
			logger.log(`HTTP server running on http://localhost:${port}`)
			logger.log(`API documentation avaliable on http://localhost:${port}/reference`)
		})
}
bootstrap()
