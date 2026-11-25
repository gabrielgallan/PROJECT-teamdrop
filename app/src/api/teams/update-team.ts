import { api } from '../../lib/ky'
import type { Team } from '../../types/team'

export interface UpdateTeamRequest {
	teamId: string
	newName: string
}

export interface UpdateTeamResponse {
	team: Team
}

export async function updateTeam(
	{ teamId, newName }: UpdateTeamRequest,
	signal?: AbortSignal,
): Promise<UpdateTeamResponse> {
	const response = await api
		.patch(`api/teams/${encodeURIComponent(teamId)}`, {
			json: { newName },
			signal,
		})
		.json<Team>()
	return { team: response }
}
