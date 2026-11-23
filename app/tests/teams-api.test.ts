import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureAuthAccess } from '../src/services/api'
import * as teams from '../src/services/teams'

const teamId = '019ab000-0000-7000-8000-000000000001'
const team = { id: teamId, slug: 'different-from-id', name: 'Team', ownerId: 'owner' }
let requests: Request[]

beforeEach(() => {
	requests = []
	configureAuthAccess({ getToken: async () => 'jwt', onFailure: vi.fn() })
	vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
		requests.push(request)
		if (request.method === 'DELETE') return new Response(null, { status: 204 })
		return Response.json({ team, users: [], url: 'https://example.com/invites/token' })
	}))
})
afterEach(() => vi.unstubAllGlobals())

describe('team HTTP contract', () => {
	it('uses team IDs for rename, members, removal and leaving', async () => {
		await teams.renameTeam(teamId, 'Renamed')
		await teams.listMembers(teamId)
		await teams.removeMember(teamId, 'member')
		await teams.leaveTeam(teamId)
		expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
			['PATCH', `/api/teams/${teamId}`],
			['GET', `/api/teams/${teamId}/members`],
			['DELETE', `/api/teams/${teamId}/members/member`],
			['DELETE', `/api/teams/${teamId}/members/me`],
		])
		expect(await requests[0].json()).toEqual({ newName: 'Renamed' })
	})

	it('creates and revokes invitations under the team ID without a slug payload', async () => {
		expect(await teams.createInvite(teamId)).toBe('https://example.com/invites/token')
		await teams.revokeInvite(teamId)
		expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
			['POST', `/api/teams/${teamId}/invites`],
			['DELETE', `/api/teams/${teamId}/invites`],
		])
		expect(await requests[0].json()).toEqual({})
		expect(requests[1].body).toBeNull()
	})

	it('keeps invitation preview and acceptance under the invites prefix', async () => {
		await teams.previewInvite('token')
		await teams.acceptInvite('token')
		expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
			['GET', '/api/invites/token/preview'],
			['POST', '/api/invites/accept'],
		])
		expect(await requests[1].json()).toEqual({ token: 'token' })
	})
})
