import { api } from '../../lib/ky'
import type { Team } from '../../types/team'

export interface CreateTeamRequest {
	name: string
}

export interface CreateTeamResponse {
	team: Team
}

export async function createTeam(
	{ name }: CreateTeamRequest,
	signal?: AbortSignal,
) {
	const response = await api.post('api/teams', { json: { name }, signal }).json<CreateTeamResponse>()
	return response
}
