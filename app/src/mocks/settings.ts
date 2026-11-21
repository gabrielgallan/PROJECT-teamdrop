import type { SessionUser } from '../types/auth'
import type { SettingsTeam, TeamSettings } from '../types/team'
import { teams } from './team'

// Settings prototype only; no team API requests.
export const settingsTeams: SettingsTeam[] = teams.map((team, index) => ({
	id: team.id,
	name: team.name,
	slug: team.id,
	role: index === 0 ? 'owner' : 'member',
}))

export function createMockTeamSettings(user: SessionUser): TeamSettings[] {
	const name = user.name?.trim() || user.email
	return settingsTeams.map((team) => ({
		...team,
		inviteUrl: null,
		members: [
			{
				id: user.id,
				name,
				initials: name
					.split(/\s+/)
					.slice(0, 2)
					.map((part) => part[0])
					.join('')
					.toUpperCase(),
				avatarUrl: user.avatarUrl ?? undefined,
				color: 'bg-indigo-400/15 text-indigo-100',
				role: team.role,
			},
			{
				id: 'mock-leonardo',
				name: 'Leonardo',
				initials: 'LE',
				color: 'bg-indigo-400/15 text-indigo-200',
				role: 'member',
			},
			{
				id: 'mock-maria',
				name: 'Maria Oliveira',
				initials: 'MO',
				color: 'bg-rose-400/15 text-rose-200',
				role: 'member',
			},
		],
	}))
}
