import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire, registerHooks } from 'node:module'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import ts from 'typescript'

registerHooks({
	resolve(specifier, context, next) {
		if (context.parentURL?.endsWith('/hooks/use-files-realtime.ts')) {
			const mocks = {
				'./use-auth':
					'export const useAuth = () => globalThis.realtimeHookAuth',
				'../auth/auth.store':
					'export const authStore = {getSnapshot: () => globalThis.realtimeHookAuth}',
				'../desktop/auth.commands':
					'export const authCommands = {getAccessToken: (...args) => globalThis.realtimeHookToken(...args)}',
				'../env':
					'export const env = {get VITE_API_URL() {return globalThis.realtimeHookUrl}}',
			}
			if (mocks[specifier])
				return {
					url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`,
					shortCircuit: true,
				}
		}
		if (specifier.startsWith('.') && context.parentURL) {
			const url = new URL(
				`${specifier.replace(/\.js$/, '')}.ts`,
				context.parentURL,
			)
			if (existsSync(url)) return { url: url.href, shortCircuit: true }
		}
		return next(specifier, context)
	},
	load(url, context, next) {
		if (url.endsWith('.ts'))
			return {
				format: 'module',
				shortCircuit: true,
				source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
					compilerOptions: {
						module: ts.ModuleKind.ESNext,
						target: ts.ScriptTarget.ES2022,
						experimentalDecorators: true,
					},
				}).outputText,
			}
		return next(url, context)
	},
})
const apiRequire = createRequire(
	new URL('../../api/package.json', import.meta.url),
)
const { Server } = apiRequire('socket.io')
const { JwtService } = apiRequire('@nestjs/jwt')
const { WebSocketGatewayService } = await import(
	'../../api/src/infrastructure/websocket/websocket.gateway.ts'
)
const { RoomsService } = await import(
	'../../api/src/infrastructure/websocket/services/rooms.service.ts'
)
const { AccessTokenService } = await import(
	'../../api/src/modules/auth/application/access-token.service.ts'
)
const { FilesEmitterService } = await import(
	'../../api/src/infrastructure/websocket/events/files/files-emitter.service.ts'
)
const { FilesService } = await import(
	'../../api/src/modules/files/application/files.service.ts'
)
const { connectFilesRealtime } = await import('../src/lib/files-realtime.ts')
const { queryKeys } = await import('../src/api/query-keys.ts')

async function until(check) {
	const deadline = Date.now() + 5000
	while (!check()) {
		assert.ok(
			Date.now() < deadline,
			'Expected websocket/cache state before timeout',
		)
		await delay(10)
	}
}

async function setup(t) {
	const user = '019af000-0000-7000-8000-000000000001'
	const other = '019af000-0000-7000-8000-000000000002'
	const team = '019af000-0000-7000-8000-000000000010'
	const memberships = new Map([
		[user, [team]],
		[other, [team]],
	])
	const files = []
	// Only storage/database are doubles. JWT, gateway, rooms, upload service,
	// emitter, Socket.IO transport and application cache controller are real.
	const prisma = {
		member: {
			findMany: async ({ where }) =>
				(memberships.get(where.userId) ?? []).map((teamId) => ({ teamId })),
			findUnique: async ({ where }) => {
				const { teamId, userId } = where.teamId_userId
				return memberships.get(userId)?.includes(teamId)
					? { teamId, userId, team: { storageRetentionSeconds: 86400 } }
					: null
			},
		},
		file: {
			create: async ({ data }) => {
				const file = { ...data, createdAt: new Date() }
				files.unshift(file)
				return file
			},
		},
	}
	const http = createServer((_req, res) => {
		res.setHeader('Content-Type', 'application/json')
		res.end(JSON.stringify({ files, nextCursor: null }))
	})
	const server = new Server(http, { transports: ['websocket'] })
	const namespace = server.of('/files')
	const access = new AccessTokenService(
		new JwtService({ secret: 'local-realtime-test-secret-32-characters' }),
	)
	const gateway = new WebSocketGatewayService(access, new RoomsService(prisma))
	gateway.server = namespace
	gateway.afterInit(namespace)
	namespace.on('connection', (socket) => {
		void gateway.handleConnection(socket)
	})
	const uploads = new FilesService(
		prisma,
		{ upload: async () => {} },
		new FilesEmitterService(gateway),
	)
	await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve))
	const baseUrl = `http://127.0.0.1:${http.address().port}`
	const token = async (id = user) =>
		(await access.sign(id, other, new Date(Date.now() + 3600000))).accessToken
	t.after(() => new Promise((resolve) => server.close(resolve)))
	return {
		user,
		other,
		team,
		memberships,
		files,
		namespace,
		gateway,
		uploads,
		baseUrl,
		token,
	}
}

function connect(t, f, overrides = {}) {
	const errors = []
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: Infinity } },
	})
	const stop = connectFilesRealtime({
		baseUrl: f.baseUrl,
		userId: f.user,
		teamIds: [f.team],
		client,
		getAccessToken: () => f.token(),
		isActive: () => true,
		onAuthFailure: (error) => errors.push(error),
		...overrides,
	})
	t.after(() => {
		stop()
		client.clear()
	})
	return { client, stop, errors }
}

test('gateway accepts auth and legacy headers; supplied invalid auth is rejected', async (t) => {
	const f = await setup(t)
	for (const options of [
		{ auth: { token: await f.token() } },
		{ extraHeaders: { Authorization: `Bearer ${await f.token()}` } },
	]) {
		const socket = io(`${f.baseUrl}/files`, {
			transports: ['websocket'],
			reconnection: false,
			...options,
		})
		t.after(() => socket.disconnect())
		await new Promise((resolve, reject) => {
			socket.once('files.ready', resolve)
			socket.once('connect_error', reject)
		})
		socket.disconnect()
	}
	for (const auth of [
		{},
		{ token: '' },
		{ token: null },
		{ token: 45 },
		{ token: 'invalid' },
	]) {
		const socket = io(`${f.baseUrl}/files`, {
			transports: ['websocket'],
			reconnection: false,
			auth,
			...(Object.hasOwn(auth, 'token')
				? { extraHeaders: { Authorization: `Bearer ${await f.token()}` } }
				: {}),
		})
		t.after(() => socket.disconnect())
		const error = await new Promise((resolve) =>
			socket.once('connect_error', resolve),
		)
		assert.equal(error.message, 'Unauthorized')
		socket.disconnect()
	}
})

test('real upload refreshes two active lists and preserves unrelated queries', async (t) => {
	const f = await setup(t)
	const a = connect(t, f)
	const b = connect(t, f, {
		userId: f.other,
		getAccessToken: () => f.token(f.other),
	})
	const observers = []
	for (const [connection, user] of [
		[a, f.user],
		[b, f.other],
	]) {
		const observer = new QueryObserver(connection.client, {
			queryKey: queryKeys.files(user, f.team),
			queryFn: async () => (await fetch(`${f.baseUrl}/files-list`)).json(),
			staleTime: Infinity,
		})
		observers.push(observer)
		t.after(observer.subscribe(() => {}))
	}
	await until(
		() =>
			f.namespace.sockets.size === 2 &&
			a.client.getQueryData(queryKeys.realtime(f.user)) === 'connected' &&
			b.client.getQueryData(queryKeys.realtime(f.other)) === 'connected' &&
			observers.every((o) => o.getCurrentResult().isSuccess),
	)
	const paged = queryKeys.files(f.user, f.team, 25)
	a.client.setQueryData(paged, [])
	const foreign = queryKeys.files('another-account', f.team)
	const anotherTeam = queryKeys.files(f.user, 'another-team')
	const members = queryKeys.members(f.user, f.team)
	for (const key of [foreign, anotherTeam, members])
		a.client.setQueryData(key, [])
	await f.uploads.uploadFile({
		userId: f.user,
		teamId: f.team,
		fileName: 'report.txt',
		fileData: Buffer.from('hello'),
		fileMimeType: 'text/plain',
		fileSize: 5,
	})
	await until(() =>
		observers.every((o) => o.getCurrentResult().data?.files.length === 1),
	)
	assert.equal(a.client.getQueryState(paged).isInvalidated, true)
	const arrivalKey = queryKeys.fileArrivals(f.user, f.team)
	assert.equal(a.client.getQueryData(arrivalKey).length, 1)
	assert.equal(a.client.getQueryData(arrivalKey)[0].fileId, f.files[0].id)
	assert.equal(a.client.getQueryData(queryKeys.realtime(f.user)), 'connected')
	f.gateway.emitToTeam(f.team, 'file:uploaded', {
		teamId: f.team,
		fileId: f.files[0].id,
	})
	await delay(40)
	assert.equal(a.client.getQueryData(arrivalKey).length, 1)
	for (const key of [foreign, anotherTeam, members])
		assert.equal(a.client.getQueryState(key).isInvalidated, false)
	f.namespace.emit('file:uploaded', { teamId: 'another-team', fileId: 'file' })
	f.namespace.emit('file:uploaded', { teamId: f.team })
	await delay(40)
	assert.equal(a.client.getQueryState(anotherTeam).isInvalidated, false)
	assert.equal(a.errors.length + b.errors.length, 0)
})

test('transport reconnection refreshes missed files with a fresh token', async (t) => {
	const f = await setup(t)
	let calls = 0
	const a = connect(t, f, {
		getAccessToken: () => {
			calls++
			return f.token()
		},
	})
	await until(() => f.namespace.sockets.size === 1)
	const key = queryKeys.files(f.user, f.team)
	a.client.setQueryData(key, [])
	f.namespace.sockets.values().next().value.conn.close()
	await until(() => f.namespace.sockets.size === 0)
	await f.uploads.uploadFile({
		userId: f.user,
		teamId: f.team,
		fileName: 'offline.txt',
		fileData: Buffer.from('x'),
		fileMimeType: 'text/plain',
		fileSize: 1,
	})
	await until(() => calls >= 2 && a.client.getQueryState(key).isInvalidated)
	assert.equal(a.errors.length, 0)
})

test('renewal retries once; persistent rejection stops instead of looping', async (t) => {
	const f = await setup(t)
	const good = await f.token()
	const calls = []
	const a = connect(t, f, {
		getAccessToken: async (rejected) => {
			calls.push(rejected)
			return rejected ? good : 'expired'
		},
	})
	await until(() => f.namespace.sockets.size === 1)
	assert.deepEqual(calls, [undefined, 'expired'])
	a.stop()
	const rejected = []
	const b = connect(t, f, {
		getAccessToken: async (value) => {
			rejected.push(value)
			return 'invalid'
		},
	})
	await until(() => b.errors.length === 1)
	assert.deepEqual(rejected, [undefined, 'invalid'])
	assert.equal(b.errors[0].code, 'UNAUTHORIZED')
	await delay(50)
	assert.equal(rejected.length, 2)
})

test('native network failures retry; invalid refresh stops with the existing auth error', async (t) => {
	const f = await setup(t)
	let calls = 0
	const a = connect(t, f, {
		getAccessToken: async () => {
			if (++calls === 1) throw { code: 'NETWORK_ERROR', message: 'offline' }
			return f.token()
		},
	})
	await until(() => f.namespace.sockets.size === 1)
	assert.equal(calls, 2)
	assert.equal(a.errors.length, 0)
	a.stop()
	const error = { code: 'INVALID_REFRESH_TOKEN', message: 'expired session' }
	const b = connect(t, f, {
		getAccessToken: async () => {
			throw error
		},
	})
	await until(() => b.errors.length === 1)
	assert.equal(b.errors[0], error)
})

test('cleanup ignores pending auth; restarting updates rooms; stale sessions ignore events', async (t) => {
	const f = await setup(t)
	let resolveToken
	const pending = connect(t, f, {
		getAccessToken: () =>
			new Promise((resolve) => {
				resolveToken = resolve
			}),
	})
	await until(() => Boolean(resolveToken))
	pending.stop()
	resolveToken(await f.token())
	await delay(40)
	assert.equal(f.namespace.sockets.size, 0)
	const a = connect(t, f)
	await until(() => f.namespace.sockets.size === 1)
	a.stop()
	const newTeam = 'new-team'
	f.memberships.set(f.user, [newTeam])
	let active = true
	const b = connect(t, f, { teamIds: [newTeam], isActive: () => active })
	await until(() =>
		[...f.namespace.sockets.values()].some((s) =>
			s.rooms.has(`team:${newTeam}`),
		),
	)
	const key = queryKeys.files(f.user, newTeam)
	b.client.setQueryData(key, [])
	f.gateway.emitToTeam(newTeam, 'file:uploaded', {
		teamId: newTeam,
		fileId: 'new-file',
	})
	await until(() => b.client.getQueryState(key).isInvalidated)
	b.client.setQueryData(key, [])
	active = false
	f.gateway.emitToTeam(newTeam, 'file:uploaded', {
		teamId: newTeam,
		fileId: 'late-event',
	})
	await delay(40)
	assert.equal(b.client.getQueryState(key).isInvalidated, false)
	b.stop()
	await until(() => f.namespace.sockets.size === 0)
})

test('hook keeps one StrictMode connection and reconnects only for membership/session changes', async (t) => {
	const { JSDOM } = await import('jsdom')
	const React = await import('react')
	const { createRoot } = await import('react-dom/client')
	const { QueryClientProvider } = await import('@tanstack/react-query')
	const { useFilesRealtime } = await import(
		'../src/hooks/use-files-realtime.ts'
	)
	const f = await setup(t)
	const dom = new JSDOM('<div id="root"></div>')
	const originalWindow = globalThis.window
	const originalDocument = globalThis.document
	globalThis.window = dom.window
	globalThis.document = dom.window.document
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	globalThis.realtimeHookUrl = f.baseUrl
	globalThis.realtimeHookToken = () => f.token()
	globalThis.realtimeHookAuth = {
		session: { user: { id: f.user } },
		canQuery: true,
		status: 'authenticated',
		needsLogin: false,
		busy: null,
	}
	const client = new QueryClient()
	const root = createRoot(dom.window.document.getElementById('root'))
	t.after(async () => {
		await React.act(async () => root.unmount())
		client.clear()
		dom.window.close()
		globalThis.window = originalWindow
		globalThis.document = originalDocument
		delete globalThis.IS_REACT_ACT_ENVIRONMENT
		delete globalThis.realtimeHookUrl
		delete globalThis.realtimeHookToken
		delete globalThis.realtimeHookAuth
	})
	let connections = 0
	f.namespace.on('connection', () => connections++)
	function Harness({ teams, loaded }) {
		useFilesRealtime(teams, loaded)
		return null
	}
	async function render(teams, loaded = true) {
		await React.act(async () =>
			root.render(
				React.createElement(
					React.StrictMode,
					null,
					React.createElement(
						QueryClientProvider,
						{ client },
						React.createElement(Harness, { teams, loaded }),
					),
				),
			),
		)
	}
	const teams = [{ id: f.team }, { id: 'second-team' }]
	f.memberships.set(
		f.user,
		teams.map((team) => team.id),
	)
	await render(teams)
	await until(() => f.namespace.sockets.size === 1)
	assert.equal(connections, 1)
	await render([{ id: 'second-team', name: 'Renamed' }, { id: f.team }])
	await delay(40)
	assert.equal(connections, 1)
	f.memberships.set(f.user, [f.team])
	await render([{ id: f.team }])
	await until(() => connections === 2 && f.namespace.sockets.size === 1)
	assert.ok(
		[...f.namespace.sockets.values()].every(
			(socket) => !socket.rooms.has('team:second-team'),
		),
	)
	globalThis.realtimeHookAuth = {
		...globalThis.realtimeHookAuth,
		session: { user: { id: f.user } },
	}
	await render([{ id: f.team }])
	await until(() => connections === 3 && f.namespace.sockets.size === 1)
	globalThis.realtimeHookAuth = {
		...globalThis.realtimeHookAuth,
		canQuery: false,
		busy: 'logout',
	}
	await render([{ id: f.team }])
	await until(() => f.namespace.sockets.size === 0)
})

test('a network failure during forced renewal preserves the rejected token on retry', async (t) => {
	const f = await setup(t)
	const good = await f.token()
	const calls = []
	let attempts = 0
	const a = connect(t, f, {
		getAccessToken: async (rejected) => {
			calls.push(rejected)
			if (!rejected) return 'rejected-token'
			if (++attempts === 1) throw { code: 'NETWORK_ERROR', message: 'offline' }
			return good
		},
	})
	await until(() => f.namespace.sockets.size === 1)
	assert.deepEqual(calls, [undefined, 'rejected-token', 'rejected-token'])
	assert.equal(a.errors.length, 0)
})
