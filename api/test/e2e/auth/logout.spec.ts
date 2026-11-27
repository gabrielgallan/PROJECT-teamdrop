import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../../../src/app.module.js'
import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js'
import { authHelper } from '../helpers/auth.helper.js'
import { databaseHelper } from '../helpers/database.helper.js'

describe('[POST] /api/auth/logout', () => {
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

	it('should revoke the user session', async () => {
		const { user, refreshToken } = await authHelper.createUserAccess(app)

		const response = await request(app.getHttpServer())
			.post('/api/auth/logout')
			.send({ refreshToken })
			.expect(204)

		expect(response.text).toBe('')
		expect(
			await prisma.session.findUnique({ where: { id: user.sessions[0].id } }),
		).toBeNull()
	})
})
