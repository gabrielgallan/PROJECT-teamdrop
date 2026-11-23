import 'reflect-metadata'
import assert from 'node:assert/strict'
import { execFile as execFileCallback, spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { promisify } from 'node:util'
import { Module } from '@nestjs/common'
import { APP_GUARD, NestFactory, Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { AccessTokenGuard } from '../dist/src/auth/guards/access-token.guard.js'
import { AccessTokenService } from '../dist/src/auth/services/access-token.service.js'
import { PrismaClient } from '../dist/src/database/prisma/client/client.js'
import { CryptographyModule } from '../dist/src/cryptography/cryptography.module.js'
import { CryptographyService } from '../dist/src/cryptography/cryptography.service.js'
import { SessionService } from '../dist/src/auth/services/session.service.js'
import { DesktopTicketService } from '../dist/src/auth/services/desktop-ticket.service.js'
import { TeamsController } from '../dist/src/http/teams/teams.controller.js'
import { TeamsService } from '../dist/src/http/teams/teams.service.js'
import { InvitesController } from '../dist/src/http/invites/invites.controller.js'
import { InvitesService } from '../dist/src/http/invites/invites.service.js'
import { InvitePageController } from '../dist/src/http/invites/invite-page.controller.js'
import { LoggingMiddleware } from '../dist/src/http/middlewares/logging/logging.middleware.js'

const execFile = promisify(execFileCallback)
const secret = 'teams-integration-test-only-secret-'.repeat(2)
const pgBin = (name) =>
	process.env.PG_BIN
		? path.join(process.env.PG_BIN, process.platform === 'win32' ? `${name}.exe` : name)
		: name
const run = (command, args) => execFile(command, args, { windowsHide: true, timeout: 60000 })
const controlPostgres = (args) =>
	new Promise((resolve, reject) => {
		// Do not pass captured pipes to the long-lived PostgreSQL child on Windows.
		const child = spawn(pgBin('pg_ctl'), args, { windowsHide: true, stdio: 'ignore' })
		child.once('error', reject)
		child.once('exit', (code) =>
			code === 0 ? resolve() : reject(new Error(`pg_ctl exited with ${code}`)),
		)
	})
let directory, database, databaseUrl, app, prisma, baseUrl, owner, member, outsider
let started = false
const bearer = new Map()
const httpLogs = []

async function freePort() {
	const server = net.createServer()
	await new Promise((resolve, reject) =>
		server.once('error', reject).listen(0, '127.0.0.1', resolve),
	)
	const port = server.address().port
	await new Promise((resolve) => server.close(resolve))
	return port
}

async function request(method, route, actor, body) {
	const response = await fetch(baseUrl + route, {
		method,
		headers: {
			...(actor ? { Authorization: `Bearer ${bearer.get(actor.id)}` } : {}),
			'Content-Type': 'application/json',
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	})
	const text = await response.text()
	return {
		status: response.status,
		headers: response.headers,
		body: text
			? response.headers.get('content-type')?.includes('application/json')
				? JSON.parse(text)
				: text
			: null,
	}
}

async function createTeam() {
	const response = await request('POST', '/api/teams', owner, { name: `Team ${randomUUID()}` })
	assert.equal(response.status, 201)
	return response.body.team
}

before(
	async () => {
		directory = await mkdtemp(path.join(tmpdir(), 'teamdrop-teams-test-'))
		database = path.join(directory, 'data')
		const port = await freePort()
		await run(pgBin('initdb'), [
			'-D',
			database,
			'-A',
			'trust',
			'-U',
			'postgres',
			'--no-locale',
			'--encoding=UTF8',
			'--no-sync',
		])
		await controlPostgres([
			'-D',
			database,
			'-l',
			path.join(directory, 'postgres.log'),
			'-o',
			`-h 127.0.0.1 -p ${port}`,
			'-w',
			'start',
		])
		started = true
		const url = `postgresql://postgres@127.0.0.1:${port}/postgres`
		databaseUrl = url
		const sql = new pg.Client({ connectionString: url })
		await sql.connect()
		try {
			const migrations = path.resolve('prisma/migrations')
			for (const name of (await readdir(migrations)).sort()) {
				if (name === 'migration_lock.toml') continue
				await sql.query(await readFile(path.join(migrations, name, 'migration.sql'), 'utf8'))
			}
		} finally {
			await sql.end()
		}
		prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
		const tokens = new AccessTokenService(new JwtService({ secret }))
		const actors = await Promise.all(
			['owner', 'member', 'outsider'].map((name) =>
				prisma.user.create({
					data: { name, email: `${name}@teams.example` },
				}),
			),
		)
		;[owner, member, outsider] = actors
		for (const actor of actors) {
			const pair = await tokens.sign(actor.id, randomUUID(), new Date(Date.now() + 86400000))
			bearer.set(actor.id, pair.accessToken)
		}
		class TestModule {}
		Module({
			imports: [CryptographyModule],
			controllers: [TeamsController, InvitesController, InvitePageController],
			providers: [
				{
					provide: TeamsService,
					useFactory: () => new TeamsService(prisma),
				},
				{
					provide: InvitesService,
					useFactory: (crypto) =>
						new InvitesService({ get: () => 'https://teamdrop.example' }, prisma, crypto),
					inject: [CryptographyService],
				},
				{ provide: APP_GUARD, useValue: new AccessTokenGuard(new Reflector(), tokens) },
			],
		})(TestModule)
		app = await NestFactory.create(TestModule, { logger: false })
		const logging = new LoggingMiddleware()
		logging.logger = {
			log: (value) => httpLogs.push(value),
			error: (value) => httpLogs.push(value),
		}
		app.use((req, res, next) => logging.use(req, res, next))
		await app.listen(0, '127.0.0.1')
		baseUrl = await app.getUrl()
	},
	{ timeout: 120000 },
)

after(async () => {
	await app?.close()
	await prisma?.$disconnect()
	if (started) await controlPostgres(['-D', database, '-m', 'immediate', '-w', 'stop'])
	if (directory) {
		assert.equal(path.dirname(directory), path.resolve(tmpdir()))
		assert.ok(path.basename(directory).startsWith('teamdrop-teams-test-'))
		await rm(directory, { recursive: true, force: true, maxRetries: 3 })
	}
})

test('requires authentication and rejects blank names through HTTP', async () => {
	assert.equal((await request('GET', '/api/teams')).status, 401)
	assert.equal((await request('POST', '/api/teams', owner, { name: '   ' })).status, 400)
	const team = await createTeam()
	for (const newName of ['', '   ']) {
		assert.equal(
			(await request('PATCH', `/api/teams/${team.id}`, owner, { newName })).status,
			400,
		)
	}
})

test('only the owner can list members, with the correct roles and public fields', async () => {
	const team = await createTeam()
	await prisma.member.create({ data: { teamId: team.id, userId: member.id } })
	for (const actor of [member, outsider]) {
		assert.equal((await request('GET', `/api/teams/${team.id}/members`, actor)).status, 403)
	}
	const response = await request('GET', `/api/teams/${team.id}/members`, owner)
	assert.equal(response.status, 200)
	assert.equal(response.body.users.find((item) => item.id === owner.id).role, 'owner')
	assert.equal(response.body.users.find((item) => item.id === member.id).role, 'member')
	assert.deepEqual(Object.keys(response.body.users[0]).sort(), [
		'avatarUrl',
		'email',
		'id',
		'name',
		'role',
	])
})

test('rename preserves ID-based access, returns the updated slug and trims the name', async () => {
	const team = await createTeam()
	const newName = `Renamed ${randomUUID()}`
	assert.equal(
		(await request('PATCH', `/api/teams/${team.id}`, outsider, { newName })).status,
		403,
	)
	const response = await request('PATCH', `/api/teams/${team.id}`, owner, {
		newName: `  ${newName}  `,
	})
	assert.equal(response.status, 200)
	assert.equal(response.body.team.id, team.id)
	assert.equal(response.body.team.name, newName)
	assert.notEqual(response.body.team.slug, team.slug)
	assert.equal(
		(await request('GET', `/api/teams/${team.id}/members`, owner)).status,
		200,
	)
})

async function invitation(team, options = {}) {
	const response = await request('POST', `/api/teams/${team.id}/invites`, owner, options)
	assert.equal(response.status, 201)
	assert.equal(response.headers.get('cache-control'), 'no-store')
	assert.deepEqual(Object.keys(response.body), ['url'])
	return { url: response.body.url, token: new URL(response.body.url).pathname.split('/').pop() }
}

test('invitations are returned once, hashed at rest, replaced and revoked', async () => {
	const team = await createTeam()
	for (const actor of [member, outsider]) {
		assert.equal(
			(await request('POST', `/api/teams/${team.id}/invites`, actor, {})).status,
			403,
		)
		assert.equal(
			(await request('DELETE', `/api/teams/${team.id}/invites`, actor)).status,
			404,
		)
	}
	assert.equal(
		(await request('POST', `/api/teams/${team.id}/invites`, undefined, {})).status,
		401,
	)
	const first = await invitation(team)
	const stored = await prisma.invite.findFirstOrThrow({
		where: { teamId: team.id, revokedAt: null },
	})
	assert.equal(stored.tokenHash, createHash('sha256').update(first.token).digest('hex'))
	assert.equal(Object.values(stored).includes(first.token), false)
	assert.equal(stored.maxUses, 100)
	assert.ok(Math.abs(stored.expiresAt.getTime() - Date.now() - 7 * 86400000) < 5000)
	assert.equal((await request('GET', '/api/invites', owner)).status, 404)
	const next = await invitation(team)
	assert.notEqual(first.token, next.token)
	assert.equal(
		(await request('POST', '/api/invites/accept', outsider, { token: first.token })).status,
		410,
	)
	for (let repeat = 0; repeat < 2; repeat++)
		assert.equal(
			(await request('DELETE', `/api/teams/${team.id}/invites`, owner)).status,
			204,
		)
	assert.equal(
		(await request('POST', '/api/invites/accept', outsider, { token: next.token })).status,
		410,
	)
})

test('public landing and authenticated preview never consume invitations', async () => {
	const team = await createTeam()
	const invite = await invitation(team)
	const page = await request('GET', `/invites/${invite.token}`)
	assert.equal(page.status, 200)
	assert.equal(page.headers.get('cache-control'), 'no-store')
	assert.equal(page.headers.get('referrer-policy'), 'no-referrer')
	assert.match(page.body, /Abrir no Teamdrop/)
	assert.ok(page.body.includes(`teamdrop://invite?token=${invite.token}`))
	assert.equal((await request('GET', `/api/invites/${invite.token}/preview`)).status, 401)
	const preview = await request('GET', `/api/invites/${invite.token}/preview`, outsider)
	assert.equal(preview.status, 200)
	assert.deepEqual(preview.body, {
		team: { id: team.id, name: team.name, slug: team.slug },
		alreadyMember: false,
	})
	assert.equal(preview.headers.get('cache-control'), 'no-store')
	assert.equal((await request('GET', `/api/invites/${invite.token}`, outsider)).status, 404)
	assert.equal(await prisma.member.count({ where: { teamId: team.id } }), 1)
	assert.equal(
		(
			await prisma.invite.findUniqueOrThrow({
				where: { tokenHash: createHash('sha256').update(invite.token).digest('hex') },
			})
		).uses,
		0,
	)
	assert.ok(!httpLogs.some((line) => line.includes(invite.token)))
	assert.ok(httpLogs.some((line) => line.includes('/invites/[redacted]/preview')))
	const accepted = await request('POST', '/api/invites/accept', outsider, { token: invite.token })
	assert.equal(accepted.status, 200)
	assert.equal(accepted.body.team.id, team.id)
	assert.equal(accepted.body.team.role, 'member')
	assert.equal(
		(await request('GET', `/api/invites/${invite.token}/preview`, outsider)).body.alreadyMember,
		true,
	)
})

test('concurrent replacement leaves a single usable invitation', async () => {
	const team = await createTeam()
	const results = await Promise.all(Array.from({ length: 4 }, () => invitation(team)))
	assert.equal(await prisma.invite.count({ where: { teamId: team.id, revokedAt: null } }), 1)
	const active = await prisma.invite.findFirstOrThrow({
		where: { teamId: team.id, revokedAt: null },
	})
	for (const item of results) {
		const valid = createHash('sha256').update(item.token).digest('hex') === active.tokenHash
		assert.equal(
			(await request('POST', '/api/invites/accept', outsider, { token: item.token })).status,
			valid ? 200 : 410,
		)
	}
})

test('acceptance is idempotent and serializes the last available use', async () => {
	const team = await createTeam()
	const invite = await invitation(team, { maxUses: 1 })
	const attempts = await Promise.all(
		[member, outsider].map((actor) =>
			request('POST', '/api/invites/accept', actor, { token: invite.token }),
		),
	)
	assert.deepEqual(attempts.map((item) => item.status).sort(), [200, 410])
	const winner = attempts[0].status === 200 ? member : outsider
	assert.equal(
		(await request('POST', '/api/invites/accept', winner, { token: invite.token })).status,
		200,
	)
	assert.equal(await prisma.member.count({ where: { teamId: team.id } }), 2)
	assert.equal((await prisma.invite.findFirstOrThrow({ where: { teamId: team.id } })).uses, 1)
	const teams = await request('GET', '/api/teams', winner)
	assert.equal(teams.body.teams.find((item) => item.id === team.id).role, 'member')
	const loser = winner === member ? outsider : member
	assert.equal((await request('GET', `/api/invites/${invite.token}/preview`, loser)).status, 410)
})

test('expired, revoked and malformed invitations cannot create memberships', async () => {
	const team = await createTeam()
	const invite = await invitation(team)
	await prisma.invite.updateMany({ where: { teamId: team.id }, data: { expiresAt: new Date(0) } })
	for (const token of [invite.token, 'bad']) {
		assert.equal((await request('POST', '/api/invites/accept', outsider, { token })).status, 410)
		assert.equal((await request('GET', `/api/invites/${token}/preview`, outsider)).status, 410)
	}
	assert.equal((await request('POST', '/api/invites/accept', outsider, {})).status, 400)
	assert.equal(await prisma.member.count({ where: { teamId: team.id } }), 1)
})

test('owners cannot leave or remove themselves; members can leave and owners remove members', async () => {
	const team = await createTeam()
	await prisma.member.create({ data: { teamId: team.id, userId: member.id } })
	await prisma.member.create({ data: { teamId: team.id, userId: outsider.id } })
	const route = `/api/teams/${team.id}/members`
	assert.equal((await request('DELETE', `${route}/me`, owner)).status, 403)
	assert.equal((await request('DELETE', `${route}/${owner.id}`, owner)).status, 403)
	assert.equal((await request('DELETE', `${route}/${outsider.id}`, member)).status, 403)
	assert.equal((await request('DELETE', `${route}/${outsider.id}`, owner)).status, 204)
	assert.equal((await request('DELETE', `${route}/me`, member)).status, 204)
	assert.equal(await prisma.member.count({ where: { teamId: team.id } }), 1)
	for (const actor of [member, outsider])
		assert.ok(
			!(await request('GET', '/api/teams', actor)).body.teams.some((item) => item.id === team.id),
		)
})

test('shared cryptography preserves existing refresh hashes and session rotation', async () => {
	const crypto = app.get(CryptographyService)
	const previous = 'a'.repeat(43)
	const stored = await prisma.session.create({
		data: {
			userId: owner.id,
			refreshTokenHash: createHash('sha256').update(previous).digest('base64url'),
			expiresAt: new Date(Date.now() + 86400000),
		},
	})
	const tokens = new AccessTokenService(new JwtService({ secret }))
	const sessions = new SessionService(prisma, tokens, crypto)
	const rotated = await sessions.rotate(previous)
	assert.match(rotated.refreshToken, /^[A-Za-z0-9_-]{43}$/)
	await assert.rejects(sessions.rotate(previous))
	assert.equal(
		(await prisma.session.findUniqueOrThrow({ where: { id: stored.id } })).refreshTokenHash,
		createHash('sha256').update(rotated.refreshToken).digest('base64url'),
	)
	await sessions.revoke(rotated.refreshToken)
	assert.equal(await prisma.session.findUnique({ where: { id: stored.id } }), null)
})

test('shared cryptography preserves PKCE S256 and single-use desktop tickets', async () => {
	const values = new Map()
	const cache = {
		set: async (key, value) => {
			values.set(key, value)
		},
		get: async (key) => values.get(key) ?? null,
		getDel: async (key) => {
			const value = values.get(key)
			values.delete(key)
			return value ?? null
		},
	}
	const tickets = new DesktopTicketService(cache, app.get(CryptographyService))
	const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
	const ticket = await tickets.create('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
	assert.match(ticket, /^[A-Za-z0-9_-]{43}$/)
	assert.equal(await tickets.exchange(ticket, verifier), null)
	await tickets.complete(ticket, owner.id)
	await assert.rejects(tickets.exchange(ticket, 'wrong-verifier'))
	assert.equal(await tickets.exchange(ticket, verifier), owner.id)
	await assert.rejects(tickets.exchange(ticket, verifier))
})

test('migrations remain compatible with the Prisma schema', async () => {
	await execFile(
		process.execPath,
		[
			path.resolve('node_modules/prisma/build/index.js'),
			'migrate',
			'diff',
			'--from-config-datasource',
			'--to-schema',
			'prisma/schema.prisma',
			'--exit-code',
		],
		{ windowsHide: true, timeout: 60000, env: { ...process.env, DATABASE_URL: databaseUrl } },
	)
})

test('Postman verifies the live teams response contract locally', async () => {
	const { stdout } = await run('postman', [
		'request',
		'GET',
		`${baseUrl}/api/teams`,
		'--auth-bearer-token',
		bearer.get(owner.id),
		'--script-post-request',
		"pm.test('teams response', () => { pm.response.to.have.status(200); pm.expect(pm.response.json().teams).to.be.an('array'); pm.response.json().teams.forEach(team => { pm.expect(team.role).to.eql('owner'); pm.expect(team.slug).to.be.a('string'); }); });",
	])
	assert.ok(stdout.includes('teams response'))
})
