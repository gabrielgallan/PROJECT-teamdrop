import { Team } from '../../../database/prisma/client/client.js'

interface TeamWithRole extends Team {
	role: string
}

export class TeamsPresenter {
	static toHTTP(team: Team, userId: string) {
		return TeamsPresenter.teamWithRoleToHTTP({
			...team,
			role: team.ownerId === userId ? 'owner' : 'member',
		})
	}

	static teamWithRoleToHTTP(teamWithRole: TeamWithRole) {
		return {
			id: teamWithRole.id,
			name: teamWithRole.name,
			slug: teamWithRole.slug,
			role: teamWithRole.role,
		}
	}
}
