import { api } from '../../lib/ky'
import type { Team } from '../../types/team'

export interface UpdateTeamRequest {
	teamId: string
	name?: string
	storageRetentionSeconds?: number
}

export interface UpdateTeamResponse {
	team: Team
}

export async function updateTeam(
	{ teamId, name, storageRetentionSeconds }: UpdateTeamRequest,
	signal?: AbortSignal,
): Promise<UpdateTeamResponse> {
	const response = await api
		.patch(`api/teams/${encodeURIComponent(teamId)}`, {
			json: { name, storageRetentionSeconds },
			signal,
		})
		.json<Team>()
	return { team: response }
}
