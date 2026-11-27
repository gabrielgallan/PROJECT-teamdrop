import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../../../src/app.module.js'
import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js'
import { authHelper } from '../helpers/auth.helper.js'
import { databaseHelper } from '../helpers/database.helper.js'
import { httpHelper } from '../helpers/http.helper.js'
import { invitesHelper } from '../helpers/invites.helper.js'
import { teamsHelper } from '../helpers/teams.helper.js'

describe('[GET] /api/invites/:token', () => {
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

	it('should return 200 with team details and the invited role for a nonmember', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const { user: owner } = await authHelper.createUserAccess(
			app,
			'owner@email.com',
		)
		const team = await teamsHelper.createTeam(prisma, owner.id)
		const invite = await invitesHelper.createInvite(prisma, team.id, owner.id)
		const response = await request(app.getHttpServer())
			.get(`/api/invites/${invite.token}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200)
		expect(response.headers['cache-control']).toBe('no-store')
		expect(response.body).toEqual({
			id: team.id,
			name: team.name,
			slug: team.slug,
			storageRetentionSeconds: team.storageRetentionSeconds,
			role: 'invited',
			createdAt: team.createdAt.toISOString(),
			updatedAt: team.updatedAt.toISOString(),
		})
		expect(
			await prisma.member.count({
				where: { teamId: team.id, userId: user.id },
			}),
		).toBe(0)
		expect(
			await prisma.invite.findUnique({ where: { id: invite.id } }),
		).toMatchObject({ uses: 0 })
	})
	it('should return 200 with the owner role even for an exhausted invite', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		const invite = await invitesHelper.createInvite(prisma, team.id, user.id)
		await prisma.invite.update({
			where: { id: invite.id },
			data: { uses: invite.maxUses },
		})
		const response = await request(app.getHttpServer())
			.get(`/api/invites/${invite.token}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200)
		expect(response.body).toMatchObject({ id: team.id, role: 'owner' })
	})
	it('should return 200 with the member role even for an exhausted invite', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const { user: owner } = await authHelper.createUserAccess(
			app,
			'owner@email.com',
		)
		const team = await teamsHelper.createTeam(prisma, owner.id)
		await teamsHelper.addMember(prisma, team.id, user.id)
		const invite = await invitesHelper.createInvite(prisma, team.id, owner.id)
		await prisma.invite.update({
			where: { id: invite.id },
			data: { uses: invite.maxUses },
		})
		const response = await request(app.getHttpServer())
			.get(`/api/invites/${invite.token}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200)
		expect(response.body).toMatchObject({ id: team.id, role: 'member' })
	})
	it('should return 410 for an unknown token', async () => {
		const { accessToken } = await authHelper.createUserAccess(app)
		const response = await request(app.getHttpServer())
			.get('/api/invites/unknown-token')
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(410)
		expect(response.body.message).toBe('Invalid or expired invitation')
	})
	it('should return 410 for a revoked invite', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		const invite = await invitesHelper.createInvite(prisma, team.id, user.id)
		await prisma.invite.update({
			where: { id: invite.id },
			data: { revokedAt: new Date() },
		})
		const response = await request(app.getHttpServer())
			.get(`/api/invites/${invite.token}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(410)
		expect(response.body.message).toBe('Invalid or expired invitation')
	})
	it('should return 410 for an expired invite', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		const invite = await invitesHelper.createInvite(prisma, team.id, user.id)
		await prisma.invite.update({
			where: { id: invite.id },
			data: { expiresAt: new Date(Date.now() - 1000) },
		})
		const response = await request(app.getHttpServer())
			.get(`/api/invites/${invite.token}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(410)
		expect(response.body.message).toBe('Invalid or expired invitation')
	})
	it('should return 410 for an exhausted invite when the user is not a member', async () => {
		const { accessToken } = await authHelper.createUserAccess(app)
		const { user: owner } = await authHelper.createUserAccess(
			app,
			'owner@email.com',
		)
		const team = await teamsHelper.createTeam(prisma, owner.id)
		const invite = await invitesHelper.createInvite(prisma, team.id, owner.id)
		await prisma.invite.update({
			where: { id: invite.id },
			data: { uses: invite.maxUses },
		})
		const response = await request(app.getHttpServer())
			.get(`/api/invites/${invite.token}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(410)
		expect(response.body.message).toBe('Invitation usage limit reached')
	})

	it('should return 401 without a bearer token', async () => {
		const response = await request(app.getHttpServer())
			.get('/api/invites/unknown-token')
			.expect(401)
		expect(response.body).toMatchObject({
			code: 'INVALID_ACCESS_TOKEN',
			message: 'Bearer access token required',
		})
	})
	it('should return 401 for an invalid access token', async () => {
		const response = await request(app.getHttpServer())
			.get('/api/invites/unknown-token')
			.set('Authorization', 'Bearer invalid')
			.expect(401)
		expect(response.body).toMatchObject({
			code: 'INVALID_ACCESS_TOKEN',
			message: 'Invalid access token',
		})
	})
	it('should return 401 for an expired access token', async () => {
		const token = await authHelper.createExpiredAccessToken(app)
		const response = await request(app.getHttpServer())
			.get('/api/invites/unknown-token')
			.set('Authorization', `Bearer ${token}`)
			.expect(401)
		expect(response.body).toMatchObject({
			code: 'ACCESS_TOKEN_EXPIRED',
			message: 'Access token expired',
		})
	})
	it('should return 429 when the request limit is exceeded', async () => {
		const responses = await Promise.all(
			Array.from({ length: 6 }, () =>
				request(app.getHttpServer()).get('/api/invites/unknown-token'),
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
