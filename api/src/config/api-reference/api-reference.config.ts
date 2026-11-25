import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import { apiReferenceTheme } from './api-reference.theme.js'

export const configureApiReference = (app: INestApplication): void => {
	const config = new DocumentBuilder()
		.setTitle('TeamDrop API')
		.setVersion('1.0')
		.addBearerAuth({
			type: 'http',
			scheme: 'bearer',
			bearerFormat: 'JWT',
			description: 'TeamDrop access token (15 minutes)',
		})
		.setLicense('MIT', 'https://opensource.org/licenses/MIT')
		.addTag(
			'Authentication',
			'Endpoints for user authentication, session management, and token lifecycle',
		)
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
			layout: 'classic',
			customCss: apiReferenceTheme,
			metaData: {
				title: 'TeamDrop API Reference',
			},
			defaultOpenAllTags: true,
		}),
	)
}
