import { randomUUID } from 'node:crypto'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../../src/app.module.js'
import { CryptographyService } from '../../../src/common/cryptography/cryptography.service.js'
import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js'
import { EnvService } from '../../../src/infrastructure/env/env.service.js'
import { authHelper } from '../helpers/auth.helper.js'
import { databaseHelper } from '../helpers/database.helper.js'
import { httpHelper } from '../helpers/http.helper.js'
import { invitesHelper } from '../helpers/invites.helper.js'
import { teamsHelper } from '../helpers/teams.helper.js'

describe('[POST] /api/invites', () => {
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

	it('should return 201 with a public URL and store only the token hash', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		const startedAt = Date.now()
		const response = await request(app.getHttpServer())
			.post('/api/invites')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ teamId: team.id, maxUses: 3, expiresIn: 3600 })
			.expect(201)
		expect(response.headers['cache-control']).toBe('no-store')
		expect(response.body).toEqual({ url: expect.any(String) })
		const publicBaseUrl = app
			.get(EnvService)
			.get('PUBLIC_BASE_URL')
			.replace(/\/$/, '')
		const token = response.body.url.slice(`${publicBaseUrl}/invites/`.length)
		expect(response.body.url).toBe(`${publicBaseUrl}/invites/${token}`)
		expect(token).not.toBe('')
		const invite = await prisma.invite.findFirstOrThrow({
			where: { teamId: team.id },
		})
		expect(invite).toMatchObject({
			authorId: user.id,
			maxUses: 3,
			uses: 0,
			revokedAt: null,
			tokenHash: app.get(CryptographyService).hashToken(token, 'hex'),
		})
		expect(invite.tokenHash).not.toBe(token)
		expect(invite.expiresAt.getTime()).toBeGreaterThanOrEqual(
			startedAt + 3600000,
		)
		expect(invite.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 3600000)
	})
	it('should return 201 with default usage and expiration limits', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		const startedAt = Date.now()
		await request(app.getHttpServer())
			.post('/api/invites')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ teamId: team.id })
			.expect(201)
		const invite = await prisma.invite.findFirstOrThrow({
			where: { teamId: team.id },
		})
		expect(invite.maxUses).toBe(100)
		expect(invite.expiresAt.getTime()).toBeGreaterThanOrEqual(
			startedAt + 604800000,
		)
		expect(invite.expiresAt.getTime()).toBeLessThanOrEqual(
			Date.now() + 604800000,
		)
	})
	it('should return 201 and revoke previous invites only for the selected team', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		const other = await teamsHelper.createTeam(prisma, user.id)
		const previous = await invitesHelper.createInvite(prisma, team.id, user.id)
		const unrelated = await invitesHelper.createInvite(
			prisma,
			other.id,
			user.id,
		)
		await request(app.getHttpServer())
			.post('/api/invites')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ teamId: team.id })
			.expect(201)
		expect(
			await prisma.invite.findUnique({ where: { id: previous.id } }),
		).toMatchObject({ revokedAt: expect.any(Date) })
		expect(
			await prisma.invite.findUnique({ where: { id: unrelated.id } }),
		).toMatchObject({ revokedAt: null })
		expect(
			await prisma.invite.count({
				where: { teamId: team.id, revokedAt: null },
			}),
		).toBe(1)
	})
	it('should return 201 for concurrent requests and leave only one active invite', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		const responses = await Promise.all(
			Array.from({ length: 2 }, () =>
				request(app.getHttpServer())
					.post('/api/invites')
					.set('Authorization', `Bearer ${accessToken}`)
					.send({ teamId: team.id })
					.expect(201),
			),
		)
		expect(responses[0].body.url).not.toBe(responses[1].body.url)
		expect(await prisma.invite.count({ where: { teamId: team.id } })).toBe(2)
		expect(
			await prisma.invite.count({
				where: { teamId: team.id, revokedAt: null },
			}),
		).toBe(1)
	})
	it('should return 400 for a missing team ID', async () => {
		const { accessToken } = await authHelper.createUserAccess(app)
		await request(app.getHttpServer())
			.post('/api/invites')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({})
			.expect(400)
	})
	it.each([0, 101, 1.5])(
		'should return 400 for invalid maxUses %s',
		async (maxUses) => {
			const { user, accessToken } = await authHelper.createUserAccess(app)
			const team = await teamsHelper.createTeam(prisma, user.id)
			await request(app.getHttpServer())
				.post('/api/invites')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({ teamId: team.id, maxUses })
				.expect(400)
			expect(await prisma.invite.count()).toBe(0)
		},
	)
	it.each([59, 2592001, 60.5])(
		'should return 400 for invalid expiresIn %s',
		async (expiresIn) => {
			const { user, accessToken } = await authHelper.createUserAccess(app)
			const team = await teamsHelper.createTeam(prisma, user.id)
			await request(app.getHttpServer())
				.post('/api/invites')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({ teamId: team.id, expiresIn })
				.expect(400)
			expect(await prisma.invite.count()).toBe(0)
		},
	)
	it('should return 403 when a regular member tries to create an invite', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const { user: owner } = await authHelper.createUserAccess(
			app,
			'owner@email.com',
		)
		const team = await teamsHelper.createTeam(prisma, owner.id)
		await teamsHelper.addMember(prisma, team.id, user.id)
		const previous = await invitesHelper.createInvite(prisma, team.id, owner.id)
		const response = await request(app.getHttpServer())
			.post('/api/invites')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ teamId: team.id })
			.expect(403)
		expect(response.body.message).toBe('User not allowed to manage team')
		expect(
			await prisma.invite.findUnique({ where: { id: previous.id } }),
		).toMatchObject({ revokedAt: null })
		expect(await prisma.invite.count()).toBe(1)
	})
	it('should return 404 for a nonexistent team', async () => {
		const { accessToken } = await authHelper.createUserAccess(app)
		const response = await request(app.getHttpServer())
			.post('/api/invites')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ teamId: randomUUID() })
			.expect(404)
		expect(response.body.message).toBe('User membership not found')
	})
	it('should return 404 when the user does not belong to the team', async () => {
		const { accessToken } = await authHelper.createUserAccess(app)
		const { user: owner } = await authHelper.createUserAccess(
			app,
			'owner@email.com',
		)
		const team = await teamsHelper.createTeam(prisma, owner.id)
		const response = await request(app.getHttpServer())
			.post('/api/invites')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ teamId: team.id })
			.expect(404)
		expect(response.body.message).toBe('User membership not found')
		expect(await prisma.invite.count()).toBe(0)
	})

	it('should return 401 without a bearer token', async () => {
		const response = await request(app.getHttpServer())
			.post('/api/invites')
			.send({ teamId: randomUUID() })
			.expect(401)
		expect(response.body).toMatchObject({
			code: 'INVALID_ACCESS_TOKEN',
			message: 'Bearer access token required',
		})
	})
	it('should return 401 for an invalid access token', async () => {
		const response = await request(app.getHttpServer())
			.post('/api/invites')
			.set('Authorization', 'Bearer invalid')
			.send({ teamId: randomUUID() })
			.expect(401)
		expect(response.body).toMatchObject({
			code: 'INVALID_ACCESS_TOKEN',
			message: 'Invalid access token',
		})
	})
	it('should return 401 for an expired access token', async () => {
		const token = await authHelper.createExpiredAccessToken(app)
		const response = await request(app.getHttpServer())
			.post('/api/invites')
			.set('Authorization', `Bearer ${token}`)
			.send({ teamId: randomUUID() })
			.expect(401)
		expect(response.body).toMatchObject({
			code: 'ACCESS_TOKEN_EXPIRED',
			message: 'Access token expired',
		})
	})
	it('should return 429 when the request limit is exceeded', async () => {
		const responses = await Promise.all(
			Array.from({ length: 6 }, () =>
				request(app.getHttpServer())
					.post('/api/invites')
					.send({ teamId: randomUUID() }),
			),
		)
		expect(
			responses.filter((response) => response.status === 401),
		).toHaveLength(5)
		const limited = responses.filter((response) => response.status === 429)
		expect(limited).toHaveLength(1)
		expect(limited[0].body.message).toBe('Too many requests')
	})
})
