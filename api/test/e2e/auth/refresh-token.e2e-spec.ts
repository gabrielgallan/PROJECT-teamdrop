import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../../src/app.module.js'
import { CryptographyService } from '../../../src/common/cryptography/cryptography.service.js'
import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js'
import { authHelper } from '../helpers/auth.helper.js'
import { databaseHelper } from '../helpers/database.helper.js'

describe('[POST] /api/auth/refresh', () => {
	let app: INestApplication
	let prisma: PrismaService

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [AppModule],
		}).compile()

		app = moduleRef.createNestApplication()
		prisma = moduleRef.get(PrismaService)

		await app.init()
	})

	beforeEach(async () => {
		await databaseHelper.cleanupDatabase(prisma)
	})

	afterAll(async () => {
		await databaseHelper.cleanupDatabase(prisma)
		await app.close()
	})

	it('should refresh access and rotate the refresh token', async () => {
		const { user, refreshToken } = await authHelper.createUserAccess(app)

		const response = await request(app.getHttpServer())
			.post('/api/auth/refresh')
			.send({ refreshToken })
			.expect(200)

		expect(response.body).toEqual({
			accessToken: expect.any(String),
			refreshToken: expect.any(String),
			tokenType: 'Bearer',
			expiresIn: expect.any(Number),
			refreshExpiresAt: user.sessions[0].expiresAt.toISOString(),
		})
		expect(response.body.refreshToken).not.toBe(refreshToken)
		expect(response.body.expiresIn).toBeGreaterThan(0)
		expect(response.body.expiresIn).toBeLessThanOrEqual(900)

		const session = await prisma.session.findUniqueOrThrow({
			where: { id: user.sessions[0].id },
		})
		const cryptoService = app.get(CryptographyService)

		expect(session.refreshTokenHash).toBe(
			cryptoService.hashToken(response.body.refreshToken),
		)
		expect(session.expiresAt).toEqual(user.sessions[0].expiresAt)

		const profile = await request(app.getHttpServer())
			.get('/api/auth/profile')
			.set('Authorization', `Bearer ${response.body.accessToken}`)
			.expect(200)

		expect(profile.body.user.id).toBe(user.id)
	})
})
