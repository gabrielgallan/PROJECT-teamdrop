import { useState } from 'react'
import { createMockTeamSettings } from '../mocks/settings'
import type { SessionUser } from '../types/auth'

// In-memory prototype state. No team endpoint is called or persisted.
export function useTeamSettings(user: SessionUser) {
	const [teams, setTeams] = useState(() => createMockTeamSettings(user))

	function createTeam(name: string) {
		const trimmed = name.trim()
		if (!trimmed) return
		const ownerName = user.name?.trim() || user.email
		const team = {
			id: crypto.randomUUID(),
			name: trimmed,
			role: 'owner' as const,
			inviteUrl: null,
			members: [
				{
					id: user.id,
					name: ownerName,
					initials: ownerName
						.split(/\s+/)
						.slice(0, 2)
						.map((part) => part[0])
						.join('')
						.toUpperCase(),
					avatarUrl: user.avatarUrl ?? undefined,
					color: 'bg-indigo-400/15 text-indigo-100',
					role: 'owner' as const,
				},
			],
		}
		setTeams((current) => [team, ...current])
	}

	function leaveTeam(teamId: string) {
		setTeams((current) => current.filter((team) => team.id !== teamId || team.role === 'owner'))
	}

	function createInvite(teamId: string) {
		const inviteUrl = `https://teamdrop.example/invite/${crypto.randomUUID()}`
		setTeams((current) =>
			current.map((team) =>
				team.id === teamId && team.role === 'owner' ? { ...team, inviteUrl } : team,
			),
		)
	}

	function removeMember(teamId: string, memberId: string) {
		setTeams((current) =>
			current.map((team) =>
				team.id === teamId && team.role === 'owner'
					? {
							...team,
							members: team.members.filter(
								(member) => member.id !== memberId || member.role === 'owner',
							),
						}
					: team,
			),
		)
	}

	function revokeInvite(teamId: string) {
		setTeams((current) =>
			current.map((team) =>
				team.id === teamId && team.role === 'owner' ? { ...team, inviteUrl: null } : team,
			),
		)
	}

	function renameTeam(teamId: string, name: string) {
		const trimmed = name.trim()
		if (!trimmed) return
		setTeams((current) =>
			current.map((team) =>
				team.id === teamId && team.role === 'owner' ? { ...team, name: trimmed } : team,
			),
		)
	}

	return { teams, createTeam, leaveTeam, createInvite, removeMember, revokeInvite, renameTeam }
}
