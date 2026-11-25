import { api } from '../../lib/ky'
import type { Team } from '../../types/team'

export interface GetInviteDetailsRequest {
	token: string
}

export interface GetInviteDetailsResponse {
	team: Pick<Team, 'id' | 'name' | 'slug'>
	alreadyMember: boolean
}

export async function getInviteDetails(
	{ token }: GetInviteDetailsRequest,
	signal?: AbortSignal,
) {
	const response = await api.get(`api/invites/${encodeURIComponent(token)}`, { signal }).json<GetInviteDetailsResponse>()
	return response
}
