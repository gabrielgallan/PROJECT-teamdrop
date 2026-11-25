import { api } from '../../lib/ky'
import type { TeamMember } from '../../types/team'

export interface GetTeamMembersRequest {
	teamId: string
}

export interface GetTeamMembersResponse {
	users: TeamMember[]
}

export async function getTeamMembers(
	{ teamId }: GetTeamMembersRequest,
	signal?: AbortSignal,
) {
	const response = await api
		.get(`api/teams/${encodeURIComponent(teamId)}/members`, { signal })
		.json<GetTeamMembersResponse>()
	return response
}
