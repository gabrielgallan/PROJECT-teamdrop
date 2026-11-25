import { api } from '../../lib/ky'
import type { Team } from '../../types/team'

export interface AcceptTeamInviteRequest {
	token: string
}

export interface AcceptTeamInviteResponse {
	team: Team
}

export async function acceptTeamInvite({ token }: AcceptTeamInviteRequest, signal?: AbortSignal) {
	const response = await api
		.post(`api/invites/${encodeURIComponent(token)}/accept`, { signal })
		.json<AcceptTeamInviteResponse>()
	return response
}
