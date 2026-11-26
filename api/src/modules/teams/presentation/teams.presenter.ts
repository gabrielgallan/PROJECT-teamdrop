import { Team } from '../../../infrastructure/database/prisma/client/client.js'
import { PublicTeamDto, Role } from './dtos/team.dto.js'

interface TeamWithRole extends Team {
	role: Role
}

export class TeamsPresenter {
	static toHTTP(team: TeamWithRole): PublicTeamDto {
		return {
			id: team.id,
			name: team.name,
			slug: team.slug,
			storageRetentionSeconds: team.storageRetentionSeconds,
			createdAt: team.createdAt,
			updatedAt: team.updatedAt,
			role: team.role,
		}
	}
}
