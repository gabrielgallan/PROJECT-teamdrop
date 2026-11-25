import { api } from '../../lib/ky'
import type { Team } from '../../types/team'

export interface GetUserTeamsResponse {
	teams: Team[]
}

export async function getUserTeams(signal?: AbortSignal) {
	const response = await api.get('api/teams', { signal }).json<GetUserTeamsResponse>()
	return response
}
