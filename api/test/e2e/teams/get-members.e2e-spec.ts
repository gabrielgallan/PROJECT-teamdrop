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

describe('[GET] /api/teams/:teamId/members', () => {
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

	it('should return 200 with the team members and their roles', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const { user: member } = await authHelper.createUserAccess(
			app,
			'member@email.com',
		)
		const { user: outsider } = await authHelper.createUserAccess(
			app,
			'outsider@email.com',
		)
		const team = await teamsHelper.createTeam(prisma, user.id)
		await teamsHelper.addMember(prisma, team.id, member.id)
		const response = await request(app.getHttpServer())
			.get(`/api/teams/${team.id}/members`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200)
		expect(response.body).toHaveLength(2)
		expect(response.body).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: user.id, role: 'owner' }),
				expect.objectContaining({ id: member.id, role: 'member' }),
			]),
		)
		expect(
			response.body.map((entry: { id: string }) => entry.id),
		).not.toContain(outsider.id)
	})
	it('should return 200 when requested by a regular member', async () => {
		const { user, accessToken } = await authHelper.createUserAccess(app)
		const { user: owner } = await authHelper.createUserAccess(
			app,
			'owner@email.com',
		)
		const team = await teamsHelper.createTeam(prisma, owner.id)
		await teamsHelper.addMember(prisma, team.id, user.id)
		await request(app.getHttpServer())
			.get(`/api/teams/${team.id}/members`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200)
	})

	it('should return 404 for a nonexistent team', async () => {
		const { accessToken } = await authHelper.createUserAccess(app)
		const response = await request(app.getHttpServer())
			.get(`/api/teams/${randomUUID()}/members`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(404)
		expect(response.body.message).toBe('User team membership not found')
	})
	it('should return 404 when the user does not belong to the team', async () => {
		const { accessToken } = await authHelper.createUserAccess(app)
		const { user: owner } = await authHelper.createUserAccess(
			app,
			'owner@email.com',
		)
		const team = await teamsHelper.createTeam(prisma, owner.id)
		const response = await request(app.getHttpServer())
			.get(`/api/teams/${team.id}/members`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(404)
		expect(response.body.message).toBe('User team membership not found')
	})

	it('should return 401 without a bearer token', async () => {
		const response = await request(app.getHttpServer())
			.get(`/api/teams/${randomUUID()}/members`)
			.expect(401)
		expect(response.body).toMatchObject({
			code: 'INVALID_ACCESS_TOKEN',
			message: 'Bearer access token required',
		})
	})
	it('should return 401 for an invalid access token', async () => {
		const response = await request(app.getHttpServer())
			.get(`/api/teams/${randomUUID()}/members`)
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
			.get(`/api/teams/${randomUUID()}/members`)
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
				return request(app.getHttpServer()).get(
					`/api/teams/${randomUUID()}/members`,
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
