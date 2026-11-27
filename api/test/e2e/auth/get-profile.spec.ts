import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../../src/app.module.js'
import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js'
import { authHelper } from '../helpers/auth.helper.js'
import { databaseHelper } from '../helpers/database.helper.js'

describe('[GET] /api/auth/profile', () => {
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

	it('should returns user authenticated profile', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)

		const response = await request(app.getHttpServer())
			.get('/api/auth/profile')
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200)

		expect(response.body).toMatchObject({
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
			},
		})
	})
})
