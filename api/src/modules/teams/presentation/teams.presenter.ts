import { Team } from '../../../infrastructure/database/prisma/client/client.js'
import { PublicTeamDto } from './dtos/team.dto.js'

interface TeamWithRole extends Team {
	role: string
}

export class TeamsPresenter {
	static toHTTP(team: TeamWithRole): PublicTeamDto {
		return {
			id: team.id,
			name: team.name,
			slug: team.slug,
			createdAt: team.createdAt,
			updatedAt: team.updatedAt,
			role: team.role,
		}
	}
}
