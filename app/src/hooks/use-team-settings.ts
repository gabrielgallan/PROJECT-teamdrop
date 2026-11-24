import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../services/teams'
import type { SessionUser } from '../types/auth'
import type { TeamSettings } from '../types/team'

// Mounted once per authenticated account, above settings and invitation screens.
export function useTeamSettings(user: SessionUser) {
	const [teams, setTeams] = useState<TeamSettings[]>([])
	const [busy, setBusy] = useState(false)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const active = useRef(false)
	const locked = useRef(false)
	const revision = useRef(0)
	const current = useRef(teams)
	current.current = teams

	const refresh = useCallback(
		async (signal?: AbortSignal) => {
			const before = revision.current
			const data = await api.listTeams(signal)
			if (!active.current || signal?.aborted || revision.current !== before) return
			setTeams((previous) =>
				data.map((team) => ({
					...api.teamView(team),
					members: previous.find((item) => item.id === team.id)?.members ?? [],
				})),
			)
			setError('')
		},
		[user.id],
	)

	useEffect(() => {
		active.current = true
		const controller = new AbortController()
		void refresh(controller.signal)
			.catch((err) => {
				if (!controller.signal.aborted) setError(api.teamError(err))
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false)
			})
		return () => {
			active.current = false
			controller.abort()
		}
	}, [refresh])

	async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
		if (locked.current || !active.current) return undefined
		locked.current = true
		setBusy(true)
		setError('')
		try {
			revision.current++
			return await action()
		} catch (err) {
			if (active.current) setError(api.teamError(err))
			return undefined
		} finally {
			locked.current = false
			if (active.current) setBusy(false)
		}
	}
	function patch(id: string, update: Partial<TeamSettings>) {
		if (active.current)
			setTeams((items) => items.map((team) => (team.id === id ? { ...team, ...update } : team)))
	}
	function find(id: string) {
		const team = current.current.find((item) => item.id === id)
		if (!team) throw new Error('Team unavailable')
		return team
	}
	return {
		teams,
		busy: busy || loading,
		loading,
		error,
		includeTeam: (team: api.ApiTeam) => {
			revision.current++
			if (active.current)
				setTeams((items) => [
					api.teamView(team),
					...items.filter((item) => item.id !== team.id),
				])
		},
		refresh: () =>
			run(async () => {
				await refresh()
				return true
			}),
		createTeam: (name: string) =>
			run(async () => {
				const team = api.teamView(await api.createTeam(name.trim()))
				if (active.current) setTeams((items) => [team, ...items])
				return true
			}),
		loadMembers: (id: string) =>
			run(async () => {
				patch(id, { members: await api.listMembers(find(id).id) })
				return true
			}),
		leaveTeam: (id: string) =>
			run(async () => {
				await api.leaveTeam(find(id).id)
				if (active.current) setTeams((items) => items.filter((team) => team.id !== id))
				return true
			}),
		renameTeam: (id: string, name: string) =>
			run(async () => {
				const team = await api.renameTeam(find(id).id, name.trim())
				patch(id, { name: team.name, slug: team.slug })
				return true
			}),
		removeMember: (id: string, memberId: string) =>
			run(async () => {
				await api.removeMember(find(id).id, memberId)
				patch(id, { members: find(id).members.filter((member) => member.id !== memberId) })
				return true
			}),
		createInvite: (id: string) => run(() => api.createInvite(find(id).id)),
		revokeInvite: (id: string) =>
			run(async () => {
				await api.revokeInvite(find(id).id)
				return true
			}),
	}
}
export type TeamActions = ReturnType<typeof useTeamSettings>
