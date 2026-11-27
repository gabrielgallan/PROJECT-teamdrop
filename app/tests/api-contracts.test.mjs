import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import ky from 'ky'
import ts from 'typescript'

// Run the real request adapters with Ky over HTTP, replacing only the desktop
// auth singleton and the React hook wrapper (not the mutation callbacks).
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (context.parentURL?.includes('/src/')) {
			const mocks = {
				'../hooks/use-auth':
					'export const useAuth = () => globalThis.fileActionAuth',
				'./use-auth': 'export const useAuth = () => globalThis.fileActionAuth',
				'../auth/auth.store':
					'export const authStore = {getSnapshot: () => globalThis.fileActionAuth}',
				'../desktop/app.commands':
					'export const copyText = (text) => globalThis.fileActionCopies.push(text)',
			}
			if (mocks[specifier])
				return {
					url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`,
					shortCircuit: true,
				}
			if (
				context.parentURL.endsWith('/desktop/files.commands.ts') &&
				specifier === '@tauri-apps/api/core'
			)
				return {
					url: 'data:text/javascript,export const isTauri = () => globalThis.fileActionDesktop; export const invoke = (...args) => globalThis.fileActionInvoke(...args)',
					shortCircuit: true,
				}
			if (specifier.endsWith('/lib/ky')) {
				return {
					url: 'data:text/javascript,export const api = new Proxy({}, {get: (_, key) => {const client = globalThis.contractApi; const value = client[key]; return typeof value === "function" ? value.bind(client) : value}})',
					shortCircuit: true,
				}
			}
			if (specifier.endsWith('/use-account-mutation')) {
				return {
					url: 'data:text/javascript,export const useAccountMutation = (mutationFn, onSuccess) => ({mutationFn, onSuccess})',
					shortCircuit: true,
				}
			}
			if (specifier.startsWith('.')) {
				const url = new URL(`${specifier}.ts`, context.parentURL)
				if (existsSync(url)) return { url: url.href, shortCircuit: true }
			}
		}
		return nextResolve(specifier, context)
	},
	load(url, context, nextLoad) {
		if (url.endsWith('.ts')) {
			return {
				format: 'module',
				source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
					compilerOptions: { module: ts.ModuleKind.ESNext },
				}).outputText,
				shortCircuit: true,
			}
		}
		return nextLoad(url, context)
	},
})

test('desktop adapters consume the current backend HTTP contracts', async (t) => {
	const team = {
		id: '019af000-0000-7000-8000-000000000001',
		name: 'Product',
		slug: 'product',
		storageRetentionSeconds: 86400,
		createdAt: '2026-11-25T12:00:00.000Z',
		updatedAt: '2026-11-25T12:00:00.000Z',
		role: 'owner',
	}
	const users = [
		{
			id: 'user-1',
			name: null,
			email: 'user@example.com',
			avatarUrl: null,
			role: 'owner',
		},
	]
	const file = {
		id: 'file-1',
		name: 'report.txt',
		mimeType: 'text/plain',
		size: 5,
		createdAt: team.createdAt,
	}
	let respond
	const requests = []
	const server = createServer(async (req, res) => {
		const chunks = []
		for await (const chunk of req) chunks.push(chunk)
		requests.push({
			method: req.method,
			url: req.url,
			headers: req.headers,
			body: Buffer.concat(chunks).toString(),
		})
		const response = typeof respond === 'function' ? respond(req) : respond
		response.beforeResponse?.()
		res.writeHead(response.status ?? 200, {
			'Content-Type': 'application/json',
		})
		res.end(
			response.body === undefined ? undefined : JSON.stringify(response.body),
		)
	})
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
	t.after(() => new Promise((resolve) => server.close(resolve)))
	globalThis.contractApi = ky.create({
		baseUrl: `http://127.0.0.1:${server.address().port}/`,
		retry: 0,
	})
	t.after(() => {
		delete globalThis.contractApi
	})
	const { getUserTeams } = await import('../src/api/teams/get-user-teams.ts')
	const { createTeam } = await import('../src/api/teams/create-team.ts')
	const { updateTeam } = await import('../src/api/teams/update-team.ts')
	const { getTeamMembers } = await import(
		'../src/api/teams/get-team-members.ts'
	)
	const { getInviteDetails } = await import(
		'../src/api/invites/get-invite-details.ts'
	)
	const { acceptTeamInvite } = await import(
		'../src/api/invites/accept-team-invite.ts'
	)
	const { uploadTeamFile } = await import(
		'../src/api/files/upload-team-file.ts'
	)

	await t.test(
		'file actions request private typed URLs and pass only signed URLs to the desktop',
		async (t) => {
			const originalApi = globalThis.contractApi
			const originalDocument = Object.getOwnPropertyDescriptor(
				globalThis,
				'document',
			)
			const { createApiClient } = await import('../src/lib/api-client.ts')
			const session = { user: { id: 'user-1' } }
			globalThis.fileActionAuth = { session, busy: null, needsLogin: false }
			globalThis.fileActionCopies = []
			globalThis.fileActionDesktop = true
			const downloads = []
			globalThis.fileActionInvoke = async (...args) => {
				downloads.push(args)
				return true
			}
			t.after(() => {
				globalThis.contractApi = originalApi
				delete globalThis.fileActionAuth
				delete globalThis.fileActionCopies
				delete globalThis.fileActionDesktop
				delete globalThis.fileActionInvoke
				if (originalDocument)
					Object.defineProperty(globalThis, 'document', originalDocument)
				else delete globalThis.document
			})
			const authenticatedApi = createApiClient({
				baseUrl: `http://127.0.0.1:${server.address().port}`,
				getAccessToken: async (rejected) =>
					rejected ? 'renewed-access-token' : 'test-access-token',
				getSession: () => globalThis.fileActionAuth.session,
				canRequest: () => !globalThis.fileActionAuth.needsLogin,
				onAuthFailure: () => {},
			})
			globalThis.contractApi = authenticatedApi
			const { useFileActions } = await import(
				'../src/hooks/use-file-actions.ts'
			)
			const { fileUrlQuery } = await import('../src/api/files/queries.ts')
			const preview = 'https://storage.example/report.txt?sig=preview'
			const attachment = 'https://storage.example/report.txt?sig=download'
			respond = { status: 201, body: { url: preview } }
			const actions = useFileActions()
			await actions.copy.mutationFn({ fileId: file.id })
			assert.deepEqual(globalThis.fileActionCopies, [preview])
			assert.equal(requests.at(-1).method, 'POST')
			assert.equal(
				requests.at(-1).url,
				`/api/files/${file.id}/url?type=preview`,
			)
			assert.equal(
				requests.at(-1).headers.authorization,
				'Bearer test-access-token',
			)
			const qr = await fileUrlQuery('user-1', team.id, file.id).queryFn({})
			assert.equal(qr.url, preview)
			assert.equal(
				requests.at(-1).url,
				`/api/files/${file.id}/url?type=preview`,
			)
			respond = { status: 201, body: { url: attachment } }
			assert.equal(await actions.download.mutationFn(file), true)
			assert.equal(
				requests.at(-1).url,
				`/api/files/${file.id}/url?type=download`,
			)
			assert.deepEqual(downloads, [
				['download_file', { url: attachment, fileName: file.name }],
			])
			let attempts = 0
			respond = () =>
				++attempts === 1
					? { status: 401, body: { code: 'ACCESS_TOKEN_EXPIRED' } }
					: { status: 201, body: { url: preview } }
			await actions.copy.mutationFn({ fileId: file.id })
			assert.equal(attempts, 2)
			assert.equal(
				requests.at(-1).headers.authorization,
				'Bearer renewed-access-token',
			)
			assert.deepEqual(globalThis.fileActionCopies, [preview, preview])
			globalThis.fileActionDesktop = false
			let clicked = false
			let removed = false
			const anchor = {
				click: () => {
					clicked = true
				},
				remove: () => {
					removed = true
				},
			}
			Object.defineProperty(globalThis, 'document', {
				configurable: true,
				value: {
					createElement: (tag) => {
						assert.equal(tag, 'a')
						return anchor
					},
					body: { append: (element) => assert.equal(element, anchor) },
				},
			})
			respond = { status: 201, body: { url: attachment } }
			assert.equal(await actions.download.mutationFn(file), true)
			assert.equal(anchor.href, attachment)
			assert.equal(anchor.download, file.name)
			assert.ok(clicked && removed)
			assert.equal(downloads.length, 1)
			respond = { status: 404, body: { message: 'File not found or expired' } }
			await assert.rejects(
				actions.download.mutationFn(file),
				(error) => error.status === 404,
			)
			assert.equal(downloads.length, 1)
			respond = {
				status: 201,
				body: { url: preview },
				beforeResponse: () => {
					globalThis.fileActionAuth.session = {}
				},
			}
			await assert.rejects(actions.copy.mutationFn({ fileId: file.id }), {
				name: 'AbortError',
			})
			assert.deepEqual(globalThis.fileActionCopies, [preview, preview])
		},
	)

	await t.test(
		'direct team and member responses preserve application cache shapes',
		async () => {
			respond = { body: [team] }
			assert.deepEqual(await getUserTeams(), { teams: [team] })
			respond = { status: 201, body: team }
			assert.deepEqual(await createTeam({ name: team.name }), { team })
			assert.deepEqual(JSON.parse(requests.at(-1).body), { name: team.name })
			const renamed = { ...team, name: 'Design', slug: 'design' }
			respond = { body: renamed }
			assert.deepEqual(
				await updateTeam({ teamId: team.id, name: renamed.name }),
				{ team: renamed },
			)
			assert.equal(requests.at(-1).method, 'PATCH')
			assert.deepEqual(JSON.parse(requests.at(-1).body), {
				name: renamed.name,
			})
			respond = { body: users }
			assert.deepEqual(await getTeamMembers({ teamId: team.id }), { users })
			respond = { body: [] }
			assert.deepEqual(await getUserTeams(), { teams: [] })
			assert.deepEqual(await getTeamMembers({ teamId: team.id }), { users: [] })
		},
	)

	await t.test(
		'retention updates preserve the team and refresh its account cache',
		async () => {
			const { useUpdateTeam } = await import('../src/api/teams/mutations.ts')
			for (const storageRetentionSeconds of [900, 86400, 259200]) {
				const updated = { ...team, storageRetentionSeconds }
				respond = { body: updated }
				const mutation = useUpdateTeam()
				const variables = { teamId: team.id, storageRetentionSeconds }
				const data = await mutation.mutationFn(variables)
				assert.deepEqual(data, { team: updated })
				assert.equal(requests.at(-1).method, 'PATCH')
				assert.equal(requests.at(-1).url, `/api/teams/${team.id}`)
				assert.deepEqual(JSON.parse(requests.at(-1).body), {
					storageRetentionSeconds,
				})
				const otherTeam = { ...team, id: 'other-team' }
				let cached = { teams: [team, otherTeam] }
				const invalidated = []
				await mutation.onSuccess(
					{
						cancelQueries: async () => {},
						setQueryData: (key, updater) => {
							assert.deepEqual(key, ['account', 'user-1', 'teams'])
							cached = updater(cached)
						},
						invalidateQueries: async (options) => invalidated.push(options),
					},
					data,
					variables,
					'user-1',
				)
				assert.deepEqual(cached, { teams: [updated, otherTeam] })
				assert.deepEqual(invalidated, [
					{ queryKey: ['account', 'user-1', 'teams'], exact: true },
				])
			}
		},
	)

	await t.test(
		'invite previews preserve all three membership roles',
		async () => {
			for (const role of ['owner', 'member', 'invited']) {
				respond = { body: { ...team, role } }
				assert.deepEqual(await getInviteDetails({ token: 'invite-token' }), {
					...team,
					role,
				})
				assert.equal(requests.at(-1).url, '/api/invites/invite-token')
			}
		},
	)

	await t.test(
		'acceptance succeeds with an empty 204 and refreshes the correct caches',
		async () => {
			respond = { status: 204 }
			assert.equal(await acceptTeamInvite({ token: 'invite-token' }), undefined)
			assert.equal(requests.at(-1).method, 'POST')
			assert.equal(requests.at(-1).url, '/api/invites/invite-token/accept')
			assert.equal(requests.at(-1).body, '')
			const { useAcceptTeamInvite } = await import(
				'../src/api/invites/mutations.ts'
			)
			const mutation = useAcceptTeamInvite()
			const variables = { token: 'invite-token', teamId: team.id }
			const data = await mutation.mutationFn(variables)
			const invalidated = []
			await mutation.onSuccess(
				{ invalidateQueries: async (options) => invalidated.push(options) },
				data,
				variables,
				'user-1',
			)
			assert.deepEqual(invalidated, [
				{ queryKey: ['account', 'user-1', 'teams'], exact: true },
				{ queryKey: ['account', 'user-1', 'teams', team.id, 'members'] },
				{ queryKey: ['account', 'user-1', 'invites', 'invite-token'] },
			])
		},
	)

	await t.test('expired invitations remain failures', async () => {
		respond = {
			status: 410,
			body: { message: 'Invalid or expired invitation' },
		}
		await assert.rejects(
			acceptTeamInvite({ token: 'expired' }),
			(error) => error.response.status === 410,
		)
	})

	await t.test(
		'multipart upload consumes the direct file response',
		async () => {
			respond = { status: 201, body: file }
			assert.deepEqual(
				await uploadTeamFile({
					teamId: team.id,
					file: new File(['hello'], file.name, { type: file.mimeType }),
				}),
				file,
			)
			assert.equal(requests.at(-1).url, `/api/teams/${team.id}/files`)
			assert.match(
				requests.at(-1).headers['content-type'],
				/^multipart\/form-data; boundary=/,
			)
			assert.match(requests.at(-1).body, /name="file"; filename="report.txt"/)
		},
	)
})
