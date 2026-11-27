import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../../src/app.module.js'
import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js'
import { authHelper } from '../helpers/auth.helper.js'
import { databaseHelper } from '../helpers/database.helper.js'
import { httpHelper } from '../helpers/http.helper.js'
import { teamsHelper } from '../helpers/teams.helper.js'

describe('[POST] /api/teams', () => {
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
		httpHelper.resetRateLimits(app)
		await databaseHelper.cleanupDatabase(prisma)
	})
	afterAll(async () => {
		await databaseHelper.cleanupDatabase(prisma)
		await app.close()
	})

	it('should return 201 and create the owner membership with default retention', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const response = await request(app.getHttpServer())
			.post('/api/teams')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ name: 'New Team' })
			.expect(201)
		expect(response.body).toEqual({
			id: expect.any(String),
			name: 'New Team',
			slug: 'new-team',
			role: 'owner',
			storageRetentionSeconds: 86400,
			createdAt: expect.any(String),
			updatedAt: expect.any(String),
		})
		expect(
			await prisma.member.findUnique({
				where: { teamId_userId: { teamId: response.body.id, userId: user.id } },
			}),
		).not.toBeNull()
	})
	it.each([900, 259200])(
		'should return 201 for retention boundary %i',
		async (storageRetentionSeconds) => {
			const { accessToken } = await authHelper.createUserAccess(app)
			const response = await request(app.getHttpServer())
				.post('/api/teams')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({ name: 'Custom Team', storageRetentionSeconds })
				.expect(201)
			expect(response.body.storageRetentionSeconds).toBe(
				storageRetentionSeconds,
			)
		},
	)
	it('should return 400 for an empty name', async () => {
		const { accessToken } = await authHelper.createUserAccess(app)
		await request(app.getHttpServer())
			.post('/api/teams')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ name: ' ' })
			.expect(400)
		expect(await prisma.team.count()).toBe(0)
	})
	it.each([899, 259201, 900.5])(
		'should return 400 for invalid retention %s',
		async (storageRetentionSeconds) => {
			const { accessToken } = await authHelper.createUserAccess(app)
			await request(app.getHttpServer())
				.post('/api/teams')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({ name: 'Invalid Team', storageRetentionSeconds })
				.expect(400)
			expect(await prisma.team.count()).toBe(0)
		},
	)
	it('should return 403 when the user already belongs to five teams', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		for (let index = 0; index < 5; index++)
			await teamsHelper.createTeam(prisma, user.id)
		const response = await request(app.getHttpServer())
			.post('/api/teams')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ name: 'Sixth Team' })
			.expect(403)
		expect(response.body.message).toBe('Team membership limit reached')
		expect(await prisma.team.count()).toBe(5)
	})
	it('should return 409 for an existing slug', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		const response = await request(app.getHttpServer())
			.post('/api/teams')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ name: team.name.toUpperCase() })
			.expect(409)
		expect(response.body.message).toBe('Team name already exists')
		expect(await prisma.team.count()).toBe(1)
	})

	it('should return 401 without a bearer token', async () => {
		const response = await request(app.getHttpServer())
			.post(`/api/teams`)
			.send({ name: 'Team' })
			.expect(401)
		expect(response.body).toMatchObject({
			code: 'INVALID_ACCESS_TOKEN',
			message: 'Bearer access token required',
		})
	})
	it('should return 401 for an invalid access token', async () => {
		const response = await request(app.getHttpServer())
			.post(`/api/teams`)
			.set('Authorization', 'Bearer invalid')
			.send({ name: 'Team' })
			.expect(401)
		expect(response.body).toMatchObject({
			code: 'INVALID_ACCESS_TOKEN',
			message: 'Invalid access token',
		})
	})
	it('should return 401 for an expired access token', async () => {
		const token = await authHelper.createExpiredAccessToken(app)
		const response = await request(app.getHttpServer())
			.post(`/api/teams`)
			.set('Authorization', `Bearer ${token}`)
			.send({ name: 'Team' })
			.expect(401)
		expect(response.body).toMatchObject({
			code: 'ACCESS_TOKEN_EXPIRED',
			message: 'Access token expired',
		})
	})

	it('should return 429 when the request limit is exceeded', async () => {
		const responses = await Promise.all(
			Array.from({ length: 6 }, () => {
				return request(app.getHttpServer())
					.post(`/api/teams`)
					.send({ name: 'Team' })
			}),
		)
		expect(
			responses.filter((response) => response.status === 401),
		).toHaveLength(5)
		const limited = responses.filter((response) => response.status === 429)
		expect(limited).toHaveLength(1)
		expect(limited[0].body.message).toBe('Too many requests')
	})
})
