// @vitest-environment jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	renderHook,
	screen,
	waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../src/services/teams'
import { useTeamSettings } from '../src/hooks/use-team-settings'
import type { TeamActions } from '../src/hooks/use-team-settings'
import { TeamSettingsScreen } from '../src/screens/team-settings-screen'
import { AcceptInviteScreen } from '../src/screens/accept-invite-screen'

vi.mock('../src/services/teams', async (original) => ({
	...(await original<typeof import('../src/services/teams')>()),
	listTeams: vi.fn(),
	createTeam: vi.fn(),
	renameTeam: vi.fn(),
	leaveTeam: vi.fn(),
	listMembers: vi.fn(),
	createInvite: vi.fn(),
	revokeInvite: vi.fn(),
	removeMember: vi.fn(),
	previewInvite: vi.fn(),
	acceptInvite: vi.fn(),
}))
vi.mock('../src/services/desktop', () => ({ copyText: vi.fn() }))

const user = { id: 'owner', name: 'Owner', email: 'owner@example.com', avatarUrl: null }
const team = {
	id: 'team',
	slug: 'original',
	name: 'Original',
	role: 'owner' as const,
}
const token = 'a'.repeat(43)
const link = `https://example.com/invites/${token}`
function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((done) => {
		resolve = done
	})
	return { promise, resolve }
}
beforeEach(() => {
	vi.clearAllMocks()
	vi.mocked(api.listTeams).mockResolvedValue([team])
	vi.mocked(api.listMembers).mockResolvedValue([])
	vi.mocked(api.previewInvite).mockResolvedValue({ team, alreadyMember: false })
})
afterEach(cleanup)

describe('teams integration state', () => {
	it('keeps using the team ID for subsequent actions after renaming', async () => {
		vi.mocked(api.renameTeam).mockResolvedValue({ ...team, slug: 'renamed', name: 'Renamed' })
		vi.mocked(api.createInvite).mockResolvedValue(link)
		const { result } = renderHook(() => useTeamSettings(user))
		await waitFor(() => expect(result.current.loading).toBe(false))
		await act(async () => {
			await result.current.renameTeam(team.id, 'Renamed')
		})
		await act(async () => {
			await result.current.createInvite(team.id)
		})
		expect(api.renameTeam).toHaveBeenCalledWith(team.id, 'Renamed')
		expect(api.createInvite).toHaveBeenCalledWith(team.id)
	})
	it.each(['loadMembers', 'leaveTeam', 'removeMember', 'revokeInvite'] as const)(
		'uses the team ID for %s',
		async (action) => {
			const { result } = renderHook(() => useTeamSettings(user))
			await waitFor(() => expect(result.current.loading).toBe(false))
			await act(async () => {
				if (action === 'removeMember') await result.current.removeMember(team.id, 'member')
				else await result.current[action](team.id)
			})
			const service = action === 'loadMembers' ? api.listMembers : api[action]
			expect(service).toHaveBeenCalledWith(
				team.id,
				...(action === 'removeMember' ? ['member'] : []),
			)
		},
	)
	it('blocks duplicate submissions while a mutation is pending', async () => {
		const pending = deferred<typeof team>()
		vi.mocked(api.createTeam).mockReturnValue(pending.promise)
		const { result } = renderHook(() => useTeamSettings(user))
		await waitFor(() => expect(result.current.loading).toBe(false))
		let first!: Promise<unknown>
		await act(async () => {
			first = result.current.createTeam('New')
			expect(await result.current.createTeam('New')).toBeUndefined()
		})
		expect(api.createTeam).toHaveBeenCalledOnce()
		await act(async () => {
			pending.resolve({ ...team, id: 'new' })
			await first
		})
	})
	it('keeps the list unchanged and exposes a recoverable error on a failed mutation', async () => {
		vi.mocked(api.leaveTeam).mockRejectedValue(new Error('Network'))
		const { result } = renderHook(() => useTeamSettings(user))
		await waitFor(() => expect(result.current.loading).toBe(false))
		await act(async () => {
			expect(await result.current.leaveTeam(team.id)).toBeUndefined()
		})
		expect(result.current.teams).toHaveLength(1)
		expect(result.current.error).toContain('Verifique a conexão')
	})
	it('does not lose a newly accepted team to a stale initial list response', async () => {
		const pending = deferred<(typeof team)[]>()
		vi.mocked(api.listTeams).mockReturnValueOnce(pending.promise)
		const { result } = renderHook(() => useTeamSettings(user))
		act(() => result.current.includeTeam(team))
		await act(async () => {
			pending.resolve([])
			await pending.promise
		})
		expect(result.current.teams[0].id).toBe(team.id)
	})
})

describe('invitation confirmation', () => {
	it('shows a direct return action for existing members without accepting again', async () => {
		vi.mocked(api.previewInvite).mockResolvedValueOnce({ team, alreadyMember: true })
		const close = vi.fn()
		const accepted = vi.fn()
		render(<AcceptInviteScreen token={token} onClose={close} onAccepted={accepted} />)
		const back = await screen.findByRole('button', { name: 'Voltar aos times' })
		expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull()
		expect(screen.queryByRole('button', { name: 'Entrar no time' })).toBeNull()
		expect(screen.queryByRole('button', { name: 'Concluir' })).toBeNull()
		fireEvent.click(back)
		expect(close).toHaveBeenCalledOnce()
		expect(api.acceptInvite).not.toHaveBeenCalled()
		expect(accepted).not.toHaveBeenCalled()
	})
	it('only accepts after confirmation, waits for success, and prevents a second POST', async () => {
		const pending = deferred<{ team: typeof team }>()
		vi.mocked(api.acceptInvite).mockReturnValue(pending.promise)
		const accepted = vi.fn()
		render(
			<AcceptInviteScreen
				token={token}
				onClose={vi.fn()}
				onAccepted={accepted}
			/>,
		)
		const confirm = await screen.findByRole('button', { name: 'Entrar no time' })
		expect(api.acceptInvite).not.toHaveBeenCalled()
		fireEvent.click(confirm)
		fireEvent.click(confirm)
		expect(api.acceptInvite).toHaveBeenCalledOnce()
		expect(accepted).not.toHaveBeenCalled()
		await act(async () => {
			pending.resolve({ team })
			await pending.promise
		})
		expect(accepted).toHaveBeenCalledWith(team)
		expect(await screen.findByRole('button', { name: 'Voltar aos times' })).toBeTruthy()
	})
	it('reports failure without claiming the user joined the team', async () => {
		vi.mocked(api.acceptInvite).mockRejectedValue(new Error('Network'))
		const accepted = vi.fn()
		render(
			<AcceptInviteScreen
				token={token}
				onClose={vi.fn()}
				onAccepted={accepted}
			/>,
		)
		fireEvent.click(await screen.findByRole('button', { name: 'Entrar no time' }))
		expect(await screen.findByRole('alert')).toBeTruthy()
		expect(accepted).not.toHaveBeenCalled()
		expect(screen.queryByRole('button', { name: 'Voltar aos times' })).toBeNull()
	})
	it('discards the generated URL when leaving the management screen and still allows revocation', async () => {
		const actions = {
			busy: false,
			error: '',
			loadMembers: vi.fn(),
			createInvite: vi.fn().mockResolvedValue(link),
		} as unknown as TeamActions
		const props = {
			team: api.teamView(team),
			currentUserId: user.id,
			onBack: vi.fn(),
			actions,
		}
		const view = render(<TeamSettingsScreen {...props} />)
		expect(screen.getByRole('button', { name: 'Revogar convites' })).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Gerar convite' }))
		fireEvent.click(screen.getByRole('button', { name: 'Gerar link' }))
		await waitFor(() =>
			expect((screen.getByLabelText('Link de convite') as HTMLInputElement).value).toBe(link),
		)
		view.unmount()
		render(<TeamSettingsScreen {...props} />)
		expect(screen.queryByLabelText('Link de convite')).toBeNull()
		expect(screen.getByRole('button', { name: 'Revogar convites' })).toBeTruthy()
	})
})
