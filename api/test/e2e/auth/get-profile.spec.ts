import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../../../src/app.module'
import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service'
import { AccessTokenService } from '../../../src/modules/auth/services/access-token.service'
import { authHelper } from '../helpers/auth.helper'
import { databaseHelper } from '../helpers/database.helper'

describe('[GET] /api/auth/profile', () => {
	let app: INestApplication
	let tokenService: AccessTokenService
	let prisma: PrismaService

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [AppModule],
		}).compile()

		app = moduleRef.createNestApplication()
		tokenService = moduleRef.get(AccessTokenService)
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
		const { user, accessToken } = await authHelper.createUserAccess(
			prisma,
			tokenService,
		)

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
