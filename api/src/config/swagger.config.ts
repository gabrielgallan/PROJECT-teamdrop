import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'
import { cleanupOpenApiDoc } from 'nestjs-zod'

export const configureSwagger = (app: INestApplication): void => {
	const config = new DocumentBuilder()
		.setTitle('TeamDrop API')
		.setDescription('')
		.setVersion('1.0')
		.addBearerAuth({
			type: 'http',
			scheme: 'bearer',
			bearerFormat: 'JWT',
			description: 'TeamDrop access token (15 minutes)',
		})
		.setLicense('MIT', 'https://opensource.org/licenses/MIT')
		.addTag('Authentication', 'Endpoints for user authentication, session management, and token lifecycle')
		.addTag('Teams', 'Endpoints for team management')
		.addTag('Invites', 'Endpoints for team invites management')
		.addTag('Files', 'Endpoints for files management')
		.addTag('Health', 'Ednpoints for server health')
		.build()

	const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config))

	app.use(
		'/reference',
		apiReference({
			content: document,
			theme: 'elysiajs',
			layout: 'classic',
		}),
	)
}
