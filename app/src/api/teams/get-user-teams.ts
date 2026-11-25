import { api } from '../../lib/ky'
import type { Team } from '../../types/team'

export interface GetUserTeamsResponse {
	teams: Team[]
}

export async function getUserTeams(
	signal?: AbortSignal,
): Promise<GetUserTeamsResponse> {
	const response = await api.get('api/teams', { signal }).json<Team[]>()
	return { teams: response }
}
