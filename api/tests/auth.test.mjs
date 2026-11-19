import 'reflect-metadata'
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { Module } from '@nestjs/common'
import { APP_GUARD, NestFactory } from '@nestjs/core'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { PrismaPg } from '@prisma/adapter-pg'
import { AccessTokenGuard } from '../dist/src/auth/guards/access-token.guard.js'
import { AccessTokenService } from '../dist/src/auth/access-token.service.js'
import { JWT_AUDIENCE, JWT_ISSUER, SESSION_TTL_SECONDS } from '../dist/src/auth/auth.constants.js'
import { AuthController } from '../dist/src/auth/auth.controller.js'
import { generateToken, hashToken } from '../dist/src/auth/auth.crypto.js'
import { AuthService } from '../dist/src/auth/auth.service.js'
import { DesktopTicketService } from '../dist/src/auth/desktop-ticket.service.js'
import { GoogleOAuthService } from '../dist/src/auth/oauth/google-oauth.service.js'
import { SessionService } from '../dist/src/auth/session.service.js'
import { CacheRepository } from '../dist/src/cache/cache.interface.js'
import { PrismaClient } from '../dist/src/database/prisma/client/client.js'
import { PrismaService } from '../dist/src/database/prisma/prisma.service.js'
import { envSchema } from '../dist/src/env/env.js'
import { HealthController } from '../dist/src/http/health/health.controller.js'
import { startPostgres } from './postgres.mjs'

const jwtSecret = 'synthetic-auth-test-secret-with-at-least-32-characters'
const jwt = new JwtService({ secret: jwtSecret })
const memory = new Map()
const cache = {
	async set(key, value, ttl = 300) {
		memory.set(key, { value, expiresAt: Date.now() + ttl * 1000 })
	},
	async get(key) {
		const entry = memory.get(key)
		return entry && entry.expiresAt > Date.now() ? entry.value : null
	},
	async getDel(key) {
		const entry = memory.get(key)
		memory.delete(key)
		return entry && entry.expiresAt > Date.now() ? entry.value : null
	},
	async delete(key) {
		memory.delete(key)
	},
}
let providerCalls = 0
const google = {
	getAuthUrl(state, challenge) {
		const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
		url.searchParams.set('state', state)
		url.searchParams.set('code_challenge', challenge)
		return url.toString()
	},
	async authenticate({ code }) {
		providerCalls++
		if (code === 'provider-error') throw new Error('Synthetic Google failure')
		return { id: code, email: `${code}@example.test`, name: 'Test User', avatarUrl: null }
	},
}
let database, prisma, app, baseUrl, sessions

before(
	async () => {
		database = await startPostgres()
		prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: database.url }) })
		await prisma.$connect()
		class TestAuthModule {}
		Module({
			imports: [JwtModule.register({ secret: jwtSecret })],
			controllers: [AuthController, HealthController],
			providers: [
				{ provide: PrismaService, useValue: prisma },
				{ provide: CacheRepository, useValue: cache },
				{ provide: GoogleOAuthService, useValue: google },
				AuthService,
				SessionService,
				AccessTokenService,
				DesktopTicketService,
				{ provide: APP_GUARD, useClass: AccessTokenGuard },
			],
		})(TestAuthModule)
		app = await NestFactory.create(TestAuthModule, { logger: false })
		await app.listen(0, '127.0.0.1')
		baseUrl = await app.getUrl()
		sessions = app.get(SessionService)
	},
	{ timeout: 60_000 },
)

after(async () => {
	if (app) await app.close()
	if (prisma) await prisma.$disconnect()
	if (database) await database.stop()
})

async function request(path, { body, token, method = body ? 'POST' : 'GET' } = {}) {
	const response = await fetch(`${baseUrl}/api/${path}`, {
		method,
		headers: {
			...(body ? { 'Content-Type': 'application/json' } : {}),
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	})
	const text = await response.text()
	return {
		status: response.status,
		headers: response.headers,
		data:
			response.headers.get('content-type')?.includes('application/json') && text
				? JSON.parse(text)
				: text,
	}
}

async function start() {
	const verifier = generateToken()
	const result = await request('auth/desktop/start', {
		body: { codeChallenge: hashToken(verifier) },
	})
	assert.equal(result.status, 200)
	assert.equal(result.headers.get('cache-control'), 'no-store')
	return {
		...result.data,
		verifier,
		state: new URL(result.data.authorizationUrl).searchParams.get('state'),
	}
}

async function exchange(attempt, verifier = attempt.verifier) {
	return request('auth/desktop/exchange', {
		body: { ticket: attempt.ticket, codeVerifier: verifier },
	})
}

async function login(subject = randomUUID()) {
	const attempt = await start()
	const callback = await request(
		`auth/google/callback?${new URLSearchParams({ state: attempt.state, code: subject })}`,
	)
	assert.equal(callback.status, 200)
	assert.match(callback.data, /Login concluído/)
	assert.equal(callback.headers.get('referrer-policy'), 'no-referrer')
	const result = await exchange(attempt)
	assert.equal(result.status, 200)
	assert.equal(result.data.status, 'complete')
	return { ...result.data, attempt, subject }
}

function signed(payload, options = {}) {
	const now = Math.floor(Date.now() / 1000)
	return jwt.sign(
		{
			sub: randomUUID(),
			sid: randomUUID(),
			iat: now,
			exp: now + 900,
			...payload,
		},
		{ algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE, ...options },
	)
}

// Produce correctly signed but malformed claims without the signing library rejecting the fixture.
function malformedClaims(payload) {
	const now = Math.floor(Date.now() / 1000)
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
	const body = Buffer.from(
		JSON.stringify({
			sub: randomUUID(),
			sid: randomUUID(),
			iss: JWT_ISSUER,
			aud: JWT_AUDIENCE,
			iat: now,
			exp: now + 900,
			...payload,
		}),
	).toString('base64url')
	const input = `${header}.${body}`
	return `${input}.${createHmac('sha256', jwtSecret).update(input).digest('base64url')}`
}

test('JWT_SECRET is required and must contain at least 32 characters', () => {
	const environment = {
		DATABASE_URL: 'postgresql://localhost/test',
		REDIS_URL: 'redis://localhost:6379',
		AZURE_STORAGE_CONTAINER: '',
		AZURE_STORAGE_CONNECTION_STRING: '',
		GOOGLE_OAUTH_CLIENT_ID: '',
		GOOGLE_OAUTH_CLIENT_SECRET: '',
		GOOGLE_OAUTH_CLIENT_REDIRECT_URI: '',
	}
	assert.equal(envSchema.safeParse(environment).success, false)
	assert.equal(envSchema.safeParse({ ...environment, JWT_SECRET: 'short' }).success, false)
	assert.equal(envSchema.safeParse({ ...environment, JWT_SECRET: jwtSecret }).success, true)
})

test('login persists only a refresh hash, issues bounded JWT, and exposes profile', async () => {
	const result = await login()
	const session = await prisma.session.findUnique({
		where: { refreshTokenHash: hashToken(result.refreshToken) },
	})
	assert.ok(session)
	assert.notEqual(session.refreshTokenHash, result.refreshToken)
	assert.equal(session.userId, result.user.id)
	assert.equal(result.tokenType, 'Bearer')
	assert.equal(result.expiresIn, 900)
	assert.equal(session.expiresAt.toISOString(), result.refreshExpiresAt)
	assert.ok(
		Math.abs(
			session.expiresAt.getTime() - session.createdAt.getTime() - SESSION_TTL_SECONDS * 1000,
		) < 1000,
	)
	const claims = jwt.verify(result.accessToken, {
		algorithms: ['HS256'],
		issuer: JWT_ISSUER,
		audience: JWT_AUDIENCE,
	})
	assert.equal(claims.sub, result.user.id)
	assert.equal(claims.sid, session.id)
	assert.equal(claims.exp - claims.iat, 900)
	assert.deepEqual(Object.keys(claims).sort(), ['aud', 'exp', 'iat', 'iss', 'sid', 'sub'])
	const me = await request('auth/me', { token: result.accessToken })
	assert.equal(me.status, 200)
	assert.deepEqual(me.data.user, result.user)
	assert.equal(me.headers.get('cache-control'), 'no-store')
	const repeated = await login(result.subject)
	assert.equal(repeated.user.id, result.user.id)
	assert.equal(await prisma.account.count({ where: { userId: result.user.id } }), 1)
	assert.equal(await prisma.session.count({ where: { userId: result.user.id } }), 2)
})

test('global guard rejects invalid tokens, distinguishes expiry, and permits public health', async () => {
	assert.equal((await request('health')).status, 200)
	for (const token of [
		undefined,
		generateToken(),
		signed({}, { issuer: 'different-issuer' }),
		signed({}, { audience: 'different-audience' }),
		signed({}, { algorithm: 'HS384' }),
		signed({ sub: 'invalid-id' }),
		signed({ sid: 'invalid-id' }),
		malformedClaims({ exp: undefined }),
		malformedClaims({ iat: undefined }),
		malformedClaims({ exp: 'invalid' }),
	]) {
		const result = await request('auth/me', { token })
		assert.equal(result.status, 401)
		assert.equal(result.data.code, 'INVALID_ACCESS_TOKEN')
	}
	const valid = signed({})
	const [header, payload, signature] = valid.split('.')
	const tampered = `${header}.${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`
	assert.equal((await request('auth/me', { token: tampered })).data.code, 'INVALID_ACCESS_TOKEN')
	const now = Math.floor(Date.now() / 1000)
	const expired = await request('auth/me', { token: signed({ iat: now - 1000, exp: now - 100 }) })
	assert.equal(expired.status, 401)
	assert.equal(expired.data.code, 'ACCESS_TOKEN_EXPIRED')
})

test('refresh rotates once, preserves deadline and rejects old or unknown credentials', async () => {
	const original = await login()
	const refreshed = await request('auth/refresh', { body: { refreshToken: original.refreshToken } })
	assert.equal(refreshed.status, 200)
	assert.equal(refreshed.headers.get('cache-control'), 'no-store')
	assert.notEqual(refreshed.data.refreshToken, original.refreshToken)
	assert.equal(refreshed.data.refreshExpiresAt, original.refreshExpiresAt)
	assert.equal((await request('auth/me', { token: refreshed.data.accessToken })).status, 200)
	assert.equal(
		await prisma.session.count({ where: { refreshTokenHash: hashToken(original.refreshToken) } }),
		0,
	)
	for (const refreshToken of [original.refreshToken, generateToken()]) {
		const invalid = await request('auth/refresh', { body: { refreshToken } })
		assert.equal(invalid.status, 401)
		assert.equal(invalid.data.code, 'INVALID_REFRESH_TOKEN')
	}
})

test('concurrent refreshes have exactly one winner on PostgreSQL', async () => {
	const original = await login()
	const results = await Promise.all(
		Array.from({ length: 8 }, () =>
			request('auth/refresh', { body: { refreshToken: original.refreshToken } }),
		),
	)
	assert.equal(results.filter((result) => result.status === 200).length, 1)
	assert.equal(results.filter((result) => result.status === 401).length, 7)
	const winner = results.find((result) => result.status === 200).data
	assert.equal(
		(await request('auth/refresh', { body: { refreshToken: winner.refreshToken } })).status,
		200,
	)
})

test('refresh expiration is absolute and JWT cannot outlive the session', async () => {
	const original = await login()
	const expiresAt = new Date(Math.floor(Date.now() / 1000) * 1000 + 60_000)
	await prisma.session.update({
		where: { refreshTokenHash: hashToken(original.refreshToken) },
		data: { expiresAt },
	})
	const refreshed = await request('auth/refresh', { body: { refreshToken: original.refreshToken } })
	assert.equal(refreshed.status, 200)
	assert.ok(refreshed.data.expiresIn > 0 && refreshed.data.expiresIn <= 60)
	assert.equal(jwt.decode(refreshed.data.accessToken).exp, expiresAt.getTime() / 1000)
	assert.equal(refreshed.data.refreshExpiresAt, expiresAt.toISOString())
	await prisma.session.update({
		where: { refreshTokenHash: hashToken(refreshed.data.refreshToken) },
		data: { expiresAt: new Date(Date.now() - 1000) },
	})
	const invalid = await request('auth/refresh', {
		body: { refreshToken: refreshed.data.refreshToken },
	})
	assert.equal(invalid.status, 401)
	assert.equal(invalid.data.code, 'INVALID_REFRESH_TOKEN')
})

test('logout is idempotent, works without JWT, and keeps other device sessions', async () => {
	const original = await login()
	const other = await sessions.create(original.user.id)
	for (let index = 0; index < 2; index++) {
		const logout = await request('auth/logout', { body: { refreshToken: original.refreshToken } })
		assert.equal(logout.status, 204)
		assert.equal(logout.data, '')
	}
	assert.equal(
		(await request('auth/refresh', { body: { refreshToken: original.refreshToken } })).status,
		401,
	)
	assert.equal(
		(await request('auth/refresh', { body: { refreshToken: other.refreshToken } })).status,
		200,
	)
	// Stateless JWT remains valid until its short expiry.
	assert.equal((await request('auth/me', { token: original.accessToken })).status, 200)
	assert.equal(
		(await request('auth/logout', { body: { refreshToken: generateToken() } })).status,
		204,
	)
})

test('pending tickets issue no session; wrong proof does not consume; replay is rejected', async () => {
	const originalCount = await prisma.session.count()
	const attempt = await start()
	assert.deepEqual((await exchange(attempt)).data, { status: 'pending' })
	assert.equal((await exchange(attempt, generateToken())).status, 401)
	assert.deepEqual((await exchange(attempt)).data, { status: 'pending' })
	assert.equal(await prisma.session.count(), originalCount)
	await request(
		`auth/google/callback?${new URLSearchParams({ state: attempt.state, code: randomUUID() })}`,
	)
	assert.equal((await exchange(attempt, generateToken())).status, 401)
	assert.equal((await exchange(attempt)).status, 200)
	assert.equal((await exchange(attempt)).status, 401)
	assert.equal(
		(
			await request(
				`auth/google/callback?${new URLSearchParams({ state: attempt.state, code: randomUUID() })}`,
			)
		).status,
		401,
	)
})

test('denied, expired, invalid and provider-failure logins cannot issue tokens', async () => {
	const originalCount = await prisma.session.count()
	const denied = await start()
	await request(
		`auth/google/callback?${new URLSearchParams({ state: denied.state, error: 'access_denied' })}`,
	)
	assert.equal((await exchange(denied)).status, 401)
	const expired = await start()
	const stateKey = `auth:oauth:${hashToken(expired.state)}`
	memory.get(stateKey).expiresAt = Date.now() - 1000
	const calls = providerCalls
	assert.equal(
		(
			await request(
				`auth/google/callback?${new URLSearchParams({ state: expired.state, code: randomUUID() })}`,
			)
		).status,
		401,
	)
	assert.equal(providerCalls, calls)
	const expiredTicket = await start()
	memory.get(`auth:desktop:${hashToken(expiredTicket.ticket)}`).expiresAt = Date.now() - 1000
	assert.equal((await exchange(expiredTicket)).status, 401)
	const failure = await start()
	const callback = await request(
		`auth/google/callback?${new URLSearchParams({ state: failure.state, code: 'provider-error' })}`,
	)
	assert.match(callback.data, /Não foi possível/)
	assert.equal((await exchange(failure)).status, 401)
	assert.equal(await prisma.session.count(), originalCount)
})

test('malformed bodies are rejected before attempting authentication', async () => {
	for (const [path, bodies] of [
		['auth/desktop/start', [{}, { codeChallenge: [] }, { codeChallenge: 'short' }]],
		['auth/desktop/exchange', [{}, { ticket: generateToken(), codeVerifier: 'short' }]],
		['auth/refresh', [{}, { refreshToken: [] }, { refreshToken: 'short' }]],
		['auth/logout', [{}, { refreshToken: null }, { refreshToken: 'short' }]],
	]) {
		for (const body of bodies) assert.equal((await request(path, { body })).status, 400)
	}
	assert.equal((await request('auth/google/callback?state=invalid&code=code')).status, 400)
})

test('a deleted user cannot renew, use a ticket, or fetch a profile', async () => {
	const original = await login()
	const attempt = await start()
	await request(
		`auth/google/callback?${new URLSearchParams({ state: attempt.state, code: original.subject })}`,
	)
	await prisma.user.delete({ where: { id: original.user.id } })
	assert.equal(await prisma.session.count({ where: { userId: original.user.id } }), 0)
	assert.equal(
		(await request('auth/refresh', { body: { refreshToken: original.refreshToken } })).status,
		401,
	)
	assert.equal((await request('auth/me', { token: original.accessToken })).status, 401)
	assert.equal((await exchange(attempt)).status, 401)
})

test('matching email alone cannot attach a new Google identity', async () => {
	const subject = randomUUID()
	await prisma.user.create({ data: { email: `${subject}@example.test` } })
	const attempt = await start()
	const callback = await request(
		`auth/google/callback?${new URLSearchParams({ state: attempt.state, code: subject })}`,
	)
	assert.match(callback.data, /Não foi possível/)
	assert.equal((await exchange(attempt)).status, 401)
	assert.equal(await prisma.account.count({ where: { providerAccountId: subject } }), 0)
})

test('signing failures do not persist or consume sessions', async () => {
	const original = await login()
	const broken = new SessionService(prisma, {
		async sign() {
			throw new Error('Synthetic signing failure')
		},
	})
	const count = await prisma.session.count({ where: { userId: original.user.id } })
	await assert.rejects(() => broken.create(original.user.id), /Synthetic signing failure/)
	assert.equal(await prisma.session.count({ where: { userId: original.user.id } }), count)
	await assert.rejects(() => broken.rotate(original.refreshToken), /Synthetic signing failure/)
	assert.ok(
		await prisma.session.findUnique({
			where: { refreshTokenHash: hashToken(original.refreshToken) },
		}),
	)
})

test('Swagger describes Bearer access, refresh contracts and public logout', () => {
	const document = SwaggerModule.createDocument(
		app,
		new DocumentBuilder().addBearerAuth({ type: 'http', scheme: 'bearer' }).build(),
	)
	assert.ok(document.paths['/api/auth/me'].get.security)
	assert.ok(document.paths['/api/auth/refresh'].post.responses['200'])
	assert.equal(document.paths['/api/auth/logout'].post.security, undefined)
	assert.ok(
		document.paths['/api/auth/desktop/exchange'].post.responses['200'].content['application/json']
			.schema.oneOf,
	)
})
