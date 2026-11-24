import { useEffect, useState } from 'react'
import type { SettingsTeam } from '../types/team'

export function useSelectedTeam(userId: string, teams: SettingsTeam[], ready: boolean) {
	const key = `teamdrop:selected-team:${userId}`
	const [selectedId, setSelectedId] = useState<string | null>(() => {
		try { return localStorage.getItem(key) } catch { return null }
	})
	const team = teams.find((item) => item.id === selectedId) ?? teams[0] ?? null

	useEffect(() => {
		if (!ready) return
		try {
			if (team) localStorage.setItem(key, team.id)
			else localStorage.removeItem(key)
		} catch { /* Selection remains available when local storage is blocked. */ }
		setSelectedId(team?.id ?? null)
	}, [key, ready, team?.id])

	return {
		team,
		selectTeam: (id: string) => {
			if (teams.some((item) => item.id === id)) setSelectedId(id)
		},
	}
}
