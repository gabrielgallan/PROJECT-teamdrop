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
			if (specifier.endsWith('/lib/ky')) {
				return {
					url: 'data:text/javascript,export const api = globalThis.contractApi',
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
		res.writeHead(respond.status ?? 200, { 'Content-Type': 'application/json' })
		res.end(
			respond.body === undefined ? undefined : JSON.stringify(respond.body),
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
				await updateTeam({ teamId: team.id, newName: renamed.name }),
				{ team: renamed },
			)
			assert.equal(requests.at(-1).method, 'PATCH')
			assert.deepEqual(JSON.parse(requests.at(-1).body), {
				newName: renamed.name,
			})
			respond = { body: users }
			assert.deepEqual(await getTeamMembers({ teamId: team.id }), { users })
			respond = { body: [] }
			assert.deepEqual(await getUserTeams(), { teams: [] })
			assert.deepEqual(await getTeamMembers({ teamId: team.id }), { users: [] })
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
