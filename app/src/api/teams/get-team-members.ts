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
): Promise<GetTeamMembersResponse> {
	const response = await api
		.get(`api/teams/${encodeURIComponent(teamId)}/members`, { signal })
		.json<TeamMember[]>()
	return { users: response }
}
