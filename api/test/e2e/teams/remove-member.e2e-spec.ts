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

describe('[DELETE] /api/teams/:teamId/members/:memberId', () => {
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

	it('should return 204 and remove the member identified by user ID', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const { user: member } = await authHelper.createUserAccess(
			app,
			'member@email.com',
		)
		const team = await teamsHelper.createTeam(prisma, user.id)
		const membership = await teamsHelper.addMember(prisma, team.id, member.id)
		const response = await request(app.getHttpServer())
			.delete(`/api/teams/${team.id}/members/${member.id}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(204)
		expect(response.text).toBe('')
		expect(
			await prisma.member.findUnique({ where: { id: membership.id } }),
		).toBeNull()
		expect(await prisma.member.count({ where: { teamId: team.id } })).toBe(1)
	})
	it('should return 409 when the owner tries to remove themselves', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		const response = await request(app.getHttpServer())
			.delete(`/api/teams/${team.id}/members/${user.id}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(409)
		expect(response.body.message).toBe('Team owners cannot remove themselves')
		expect(await prisma.member.count({ where: { teamId: team.id } })).toBe(1)
	})
	it('should return 404 when the target user is not a member', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const team = await teamsHelper.createTeam(prisma, user.id)
		const response = await request(app.getHttpServer())
			.delete(`/api/teams/${team.id}/members/${randomUUID()}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(404)
		expect(response.body.message).toBe('Resource not found')
	})
	it('should return 404 when a regular member tries to remove the owner', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const { user: owner } = await authHelper.createUserAccess(
			app,
			'owner@email.com',
		)
		const team = await teamsHelper.createTeam(prisma, owner.id)
		await teamsHelper.addMember(prisma, team.id, user.id)
		const response = await request(app.getHttpServer())
			.delete(`/api/teams/${team.id}/members/${owner.id}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(404)
		expect(response.body.message).toBe('Resource not found')
		expect(await prisma.member.count({ where: { teamId: team.id } })).toBe(2)
	})

	it('should return 404 for a nonexistent team', async () => {
		const { accessToken } = await authHelper.createUserAccess(app)
		const response = await request(app.getHttpServer())
			.delete(`/api/teams/${randomUUID()}/members/${randomUUID()}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(404)
		expect(response.body.message).toBe('Resource not found')
	})
	it('should return 404 when the user does not belong to the team', async () => {
		const { accessToken } = await authHelper.createUserAccess(app)
		const { user: owner } = await authHelper.createUserAccess(
			app,
			'owner@email.com',
		)
		const team = await teamsHelper.createTeam(prisma, owner.id)
		const response = await request(app.getHttpServer())
			.delete(`/api/teams/${team.id}/members/${owner.id}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(404)
		expect(response.body.message).toBe('Resource not found')
	})

	it('should return 401 without a bearer token', async () => {
		const response = await request(app.getHttpServer())
			.delete(`/api/teams/${randomUUID()}/members/${randomUUID()}`)
			.expect(401)
		expect(response.body).toMatchObject({
			code: 'INVALID_ACCESS_TOKEN',
			message: 'Bearer access token required',
		})
	})
	it('should return 401 for an invalid access token', async () => {
		const response = await request(app.getHttpServer())
			.delete(`/api/teams/${randomUUID()}/members/${randomUUID()}`)
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
			.delete(`/api/teams/${randomUUID()}/members/${randomUUID()}`)
			.set('Authorization', `Bearer ${token}`)
			.expect(401)
		expect(response.body).toMatchObject({
			code: 'ACCESS_TOKEN_EXPIRED',
			message: 'Access token expired',
		})
	})

	it('should return 429 when the request limit is exceeded', async () => {
		const responses = await Promise.all(
			Array.from({ length: 6 }, () => {
				return request(app.getHttpServer()).delete(
					`/api/teams/${randomUUID()}/members/${randomUUID()}`,
				)
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
