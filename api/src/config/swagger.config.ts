import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'
import { cleanupOpenApiDoc } from 'nestjs-zod'

export const configureSwagger = (app: INestApplication): void => {
	const config = new DocumentBuilder()
		.setTitle('Team Drop API')
		.setDescription('')
		.setVersion('1.0')
		.setLicense('MIT', 'https://opensource.org/licenses/MIT')
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
