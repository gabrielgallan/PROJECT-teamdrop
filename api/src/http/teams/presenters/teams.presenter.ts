import { Team } from "../../../database/prisma/client/client.js";

interface TeamWithRole extends Team {
	role: string
}

export class TeamsPresenter {
	static toHTTP(team: Team) {
		return {
			...team,
			ownerId: undefined,
			createdAt: undefined,
			updatedAt: undefined,
		}
	}

	static teamWithRoleToHTTP(teamWithRole: TeamWithRole) {
		return {
			...teamWithRole,
			ownerId: undefined,
			createdAt: undefined,
			updatedAt: undefined,
		}
	}
}
