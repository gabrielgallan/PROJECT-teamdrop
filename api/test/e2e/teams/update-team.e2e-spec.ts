import { randomUUID } from 'node:crypto'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../../src/app.module.js'
import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js'
import { authHelper } from '../helpers/auth.helper.js'
import { databaseHelper } from '../helpers/database.helper.js'
import { httpHelper } from '../helpers/http.helper.js'
import { teamsHelper } from '../helpers/teams.helper.js'

describe('[PATCH] /api/teams/:teamId', () => {
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

	it('should return 200 and persist the new name, slug and retention', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		const response = await request(app.getHttpServer())
			.patch(`/api/teams/${team.id}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ name: 'Renamed Team', storageRetentionSeconds: 900 })
			.expect(200)
		expect(response.body).toMatchObject({
			id: team.id,
			name: 'Renamed Team',
			slug: 'renamed-team',
			role: 'owner',
			storageRetentionSeconds: 900,
		})
		expect(
			await prisma.team.findUnique({ where: { id: team.id } }),
		).toMatchObject({
			name: 'Renamed Team',
			slug: 'renamed-team',
			storageRetentionSeconds: 900,
		})
	})
	it('should return 200 when keeping the existing slug', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		await request(app.getHttpServer())
			.patch(`/api/teams/${team.id}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ name: team.name })
			.expect(200)
	})
	it('should return 200 for a retention-only update without changing file expiration', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		const file = await prisma.file.create({
			data: {
				name: 'file.txt',
				storageKey: randomUUID(),
				mimeType: 'text/plain',
				size: 1,
				expiresAt: new Date(Date.now() + 86400000),
				authorId: user.id,
				teamId: team.id,
			},
		})
		const response = await request(app.getHttpServer())
			.patch(`/api/teams/${team.id}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ storageRetentionSeconds: 259200 })
			.expect(200)
		expect(response.body).toMatchObject({
			name: team.name,
			slug: team.slug,
			storageRetentionSeconds: 259200,
		})
		expect(
			await prisma.file.findUnique({ where: { id: file.id } }),
		).toMatchObject({ expiresAt: file.expiresAt })
	})
	it('should return 400 for an empty name', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		await request(app.getHttpServer())
			.patch(`/api/teams/${team.id}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ name: ' ' })
			.expect(400)
		expect(
			await prisma.team.findUnique({ where: { id: team.id } }),
		).toMatchObject({ name: team.name })
	})
	it.each([899, 259201, 900.5])(
		'should return 400 for invalid retention %s',
		async (storageRetentionSeconds) => {
			const { user, accessToken } = await authHelper.createUserAccess(app)
			const team = await teamsHelper.createTeam(prisma, user.id)
			await request(app.getHttpServer())
				.patch(`/api/teams/${team.id}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.send({ storageRetentionSeconds })
				.expect(400)
			expect(
				await prisma.team.findUnique({ where: { id: team.id } }),
			).toMatchObject({ storageRetentionSeconds: 86400 })
		},
	)
	it('should return 404 for a nonexistent team', async () => {
		const { accessToken } = await authHelper.createUserAccess(app)
		const response = await request(app.getHttpServer())
			.patch(`/api/teams/${randomUUID()}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ name: 'Updated' })
			.expect(404)
		expect(response.body.message).toBe('Resource not found')
	})
	it('should return 404 when a member is not the owner', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const { user: owner } = await authHelper.createUserAccess(
			app,
			'owner@email.com',
		)
		const team = await teamsHelper.createTeam(prisma, owner.id)
		await teamsHelper.addMember(prisma, team.id, user.id)
		const response = await request(app.getHttpServer())
			.patch(`/api/teams/${team.id}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ name: 'Updated' })
			.expect(404)
		expect(response.body.message).toBe('Resource not found')
		expect(
			await prisma.team.findUnique({ where: { id: team.id } }),
		).toMatchObject({ name: team.name })
	})
	it('should return 409 when another team already uses the slug', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		const other = await teamsHelper.createTeam(prisma, user.id)
		const response = await request(app.getHttpServer())
			.patch(`/api/teams/${team.id}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ name: other.name })
			.expect(409)
		expect(response.body.message).toBe('Team name already exists')
		expect(
			await prisma.team.findUnique({ where: { id: team.id } }),
		).toMatchObject({ name: team.name })
	})

	it('should return 401 without a bearer token', async () => {
		const response = await request(app.getHttpServer())
			.patch(`/api/teams/${randomUUID()}`)
			.send({ name: 'Team' })
			.expect(401)
		expect(response.body).toMatchObject({
			code: 'INVALID_ACCESS_TOKEN',
			message: 'Bearer access token required',
		})
	})
	it('should return 401 for an invalid access token', async () => {
		const response = await request(app.getHttpServer())
			.patch(`/api/teams/${randomUUID()}`)
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
			.patch(`/api/teams/${randomUUID()}`)
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
					.patch(`/api/teams/${randomUUID()}`)
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
