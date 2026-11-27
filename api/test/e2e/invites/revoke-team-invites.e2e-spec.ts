import { randomUUID } from 'node:crypto'
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

describe('[DELETE] /api/invites', () => {
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

	it('should return 204 and revoke active invites only for the selected team', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		const other = await teamsHelper.createTeam(prisma, user.id)
		const first = await invitesHelper.createInvite(prisma, team.id, user.id)
		const second = await invitesHelper.createInvite(prisma, team.id, user.id)
		const alreadyRevoked = await invitesHelper.createInvite(
			prisma,
			team.id,
			user.id,
		)
		const revokedAt = new Date(Date.now() - 60000)
		await prisma.invite.update({
			where: { id: alreadyRevoked.id },
			data: { revokedAt },
		})
		const unrelated = await invitesHelper.createInvite(
			prisma,
			other.id,
			user.id,
		)
		const response = await request(app.getHttpServer())
			.delete('/api/invites')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ teamId: team.id })
			.expect(204)
		expect(response.text).toBe('')
		for (const id of [first.id, second.id])
			expect(await prisma.invite.findUnique({ where: { id } })).toMatchObject({
				revokedAt: expect.any(Date),
			})
		expect(
			await prisma.invite.findUnique({ where: { id: alreadyRevoked.id } }),
		).toMatchObject({ revokedAt })
		expect(
			await prisma.invite.findUnique({ where: { id: unrelated.id } }),
		).toMatchObject({ revokedAt: null })
	})
	it('should return 204 when there are no active invites', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		await request(app.getHttpServer())
			.delete('/api/invites')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ teamId: team.id })
			.expect(204)
	})
	it('should return 400 for a missing team ID', async () => {
		const { accessToken } = await authHelper.createUserAccess(app)
		await request(app.getHttpServer())
			.delete('/api/invites')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({})
			.expect(400)
	})
	it('should return 403 when a regular member tries to revoke invites', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const { user: owner } = await authHelper.createUserAccess(
			app,
			'owner@email.com',
		)
		const team = await teamsHelper.createTeam(prisma, owner.id)
		await teamsHelper.addMember(prisma, team.id, user.id)
		const invite = await invitesHelper.createInvite(prisma, team.id, owner.id)
		const response = await request(app.getHttpServer())
			.delete('/api/invites')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ teamId: team.id })
			.expect(403)
		expect(response.body.message).toBe('User not allowed to manage team')
		expect(
			await prisma.invite.findUnique({ where: { id: invite.id } }),
		).toMatchObject({ revokedAt: null })
	})
	it('should return 404 for a nonexistent team', async () => {
		const { accessToken } = await authHelper.createUserAccess(app)
		const response = await request(app.getHttpServer())
			.delete('/api/invites')
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
		const invite = await invitesHelper.createInvite(prisma, team.id, owner.id)
		const response = await request(app.getHttpServer())
			.delete('/api/invites')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ teamId: team.id })
			.expect(404)
		expect(response.body.message).toBe('User membership not found')
		expect(
			await prisma.invite.findUnique({ where: { id: invite.id } }),
		).toMatchObject({ revokedAt: null })
	})

	it('should return 401 without a bearer token', async () => {
		const response = await request(app.getHttpServer())
			.delete('/api/invites')
			.send({ teamId: randomUUID() })
			.expect(401)
		expect(response.body).toMatchObject({
			code: 'INVALID_ACCESS_TOKEN',
			message: 'Bearer access token required',
		})
	})
	it('should return 401 for an invalid access token', async () => {
		const response = await request(app.getHttpServer())
			.delete('/api/invites')
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
			.delete('/api/invites')
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
					.delete('/api/invites')
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
