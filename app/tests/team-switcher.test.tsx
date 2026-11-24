// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TeamSwitcher } from '../src/components/team-switcher'
import { useSelectedTeam } from '../src/hooks/use-selected-team'
import { useTeamSettings } from '../src/hooks/use-team-settings'
import { configureAuthAccess } from '../src/services/api'
import type { SettingsTeam } from '../src/types/team'

const teams: SettingsTeam[] = Array.from({ length: 7 }, (_, index) => ({
	id: `team-${index}`, name: `Equipe ${index}`, slug: `equipe-${index}`, role: 'member',
}))
const key = (user: string) => `teamdrop:selected-team:${user}`

beforeEach(() => {
	localStorage.clear()
	// jsdom does not implement the browser's top-layer Popover API.
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
	Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value() {
		this.hidden = false
		this.style.display = 'flex'
		this.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' }))
	} })
	Object.defineProperty(HTMLElement.prototype, 'hidePopover', { configurable: true, value() {
		this.hidden = true
		this.style.display = 'none'
		this.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'closed' }))
	} })
})
afterEach(() => {
	cleanup()
	vi.unstubAllGlobals()
	delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover
	delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover
})

function setup(overrides: Partial<React.ComponentProps<typeof TeamSwitcher>> = {}) {
	const props = {
		teams, selectedId: teams[0].id, onSelect: vi.fn(), onManage: vi.fn(), onRetry: vi.fn(),
		loading: false, error: '', ...overrides,
	}
	const view = render(<TeamSwitcher {...props} />)
	return { ...view, props }
}

describe('team picker', () => {
	it('searches, selects a team and returns focus to the trigger', async () => {
		const { props } = setup()
		const trigger = screen.getByRole('button', { name: 'Time atual: Equipe 0' })
		fireEvent.click(trigger)
		const search = screen.getByRole('textbox', { name: 'Buscar time' })
		expect(document.activeElement).toBe(search)
		fireEvent.change(search, { target: { value: ' EQUIPE 6 ' } })
		expect(screen.queryByRole('button', { name: 'Equipe 1' })).toBeNull()
		fireEvent.keyDown(search, { key: 'ArrowDown' })
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Equipe 6' }))
		fireEvent.click(screen.getByRole('button', { name: 'Equipe 6' }))
		expect(props.onSelect).toHaveBeenCalledWith(teams[6].id)
		expect(document.activeElement).toBe(trigger)
		await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'))
	})

	it('focuses the current team, supports arrows and closes with Escape for a short list', () => {
		setup({ teams: teams.slice(0, 2) })
		const trigger = screen.getByRole('button', { name: 'Time atual: Equipe 0' })
		fireEvent.click(trigger)
		expect(screen.queryByRole('textbox')).toBeNull()
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Equipe 0' }))
		fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Equipe 1' }))
		fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
		expect(document.activeElement).toBe(trigger)
	})

	it('shows a search empty state and offers retry after a loading error', () => {
		const { props, rerender } = setup()
		fireEvent.click(screen.getByRole('button', { name: 'Time atual: Equipe 0' }))
		fireEvent.change(screen.getByRole('textbox'), { target: { value: 'inexistente' } })
		expect(screen.getByRole('status').textContent).toContain('Nenhum time encontrado')
		rerender(<TeamSwitcher {...props} teams={[]} selectedId={null} error="Falha de conexão" />)
		fireEvent.click(screen.getByRole('button', { name: 'Selecionar ou criar um time' }))
		fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
		expect(props.onRetry).toHaveBeenCalledOnce()
	})

	it('handles no teams, one team, loading and an upload in progress', () => {
		const { props, rerender } = setup({ teams: [], selectedId: null })
		fireEvent.click(screen.getByRole('button', { name: 'Selecionar ou criar um time' }))
		expect(props.onManage).toHaveBeenCalledOnce()
		rerender(<TeamSwitcher {...props} teams={teams.slice(0, 1)} selectedId={teams[0].id} />)
		expect((screen.getByRole('button', { name: 'Time atual: Equipe 0' }) as HTMLButtonElement).disabled).toBe(true)
		rerender(<TeamSwitcher {...props} loading />)
		expect((screen.getByRole('button', { name: 'Carregando times' }) as HTMLButtonElement).disabled).toBe(true)
		rerender(<TeamSwitcher {...props} teams={teams} selectedId={teams[0].id} disabled />)
		expect((screen.getByRole('button', { name: 'Time atual: Equipe 0' }) as HTMLButtonElement).disabled).toBe(true)
	})
})

describe('selected team and API integration', () => {
	it('loads teams through the authenticated endpoint, persists the choice and handles membership removal', async () => {
		configureAuthAccess({ getToken: async () => 'test-jwt', onFailure: vi.fn() })
		const fetch = vi.fn(async () => Response.json({ teams }))
		vi.stubGlobal('fetch', fetch)
		localStorage.setItem(key('user'), teams[4].id)
		const { result } = renderHook(() => {
			const state = useTeamSettings({ id: 'user', name: null, email: 'user@example.com', avatarUrl: null })
			return { state, selection: useSelectedTeam('user', state.teams, !state.loading && !state.error) }
		})
		await waitFor(() => expect(result.current.state.loading).toBe(false))
		expect(fetch).toHaveBeenCalledOnce()
		const request = fetch.mock.calls[0][0] as unknown as Request
		expect(new URL(request.url).pathname).toBe('/api/teams')
		expect(request.headers.get('Authorization')).toBe('Bearer test-jwt')
		expect(result.current.selection.team?.id).toBe(teams[4].id)
		act(() => result.current.selection.selectTeam(teams[1].id))
		expect(localStorage.getItem(key('user'))).toBe(teams[1].id)
		fetch.mockResolvedValueOnce(Response.json({ teams: [teams[0]] }))
		await act(async () => { await result.current.state.refresh() })
		expect(result.current.selection.team?.id).toBe(teams[0].id)
		expect(localStorage.getItem(key('user'))).toBe(teams[0].id)
	})

	it('does not erase the saved choice before a successful load and isolates accounts', () => {
		localStorage.setItem(key('first'), teams[2].id)
		const first = renderHook(({ list, ready }) => useSelectedTeam('first', list, ready), {
			initialProps: { list: [] as SettingsTeam[], ready: false },
		})
		expect(localStorage.getItem(key('first'))).toBe(teams[2].id)
		first.rerender({ list: teams, ready: true })
		expect(first.result.current.team?.id).toBe(teams[2].id)
		const second = renderHook(() => useSelectedTeam('second', teams, true))
		expect(second.result.current.team?.id).toBe(teams[0].id)
		first.rerender({ list: [], ready: true })
		expect(first.result.current.team).toBeNull()
		expect(localStorage.getItem(key('first'))).toBeNull()
	})
})
