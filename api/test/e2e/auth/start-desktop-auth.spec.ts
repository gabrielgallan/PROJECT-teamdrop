import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../../../src/app.module.js'
import { authHelper } from '../helpers/auth.helper.js'

describe('[POST] /api/auth/desktop/start', () => {
	let app: INestApplication

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [AppModule],
		}).compile()

		app = moduleRef.createNestApplication()

		await app.init()
	})

	afterAll(async () => {
		await app.close()
	})

	it('should start auth process with PKCE', async () => {
		const response = await request(app.getHttpServer())
			.post('/api/auth/desktop/start')
			.send({
				codeChallenge: authHelper.generatePKCE().codeChallenge,
			})
			.expect(200)

		expect(response.body).toEqual({
			ticket: expect.any(String),
			authorizationUrl: expect.any(String),
			expiresIn: expect.any(Number),
			interval: expect.any(Number),
		})
	})
})
