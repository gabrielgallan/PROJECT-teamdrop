import { api } from '../../lib/ky'

export interface AcceptTeamInviteRequest {
	token: string
}

export async function acceptTeamInvite(
	{ token }: AcceptTeamInviteRequest,
	signal?: AbortSignal,
) {
	await api.post(`api/invites/${encodeURIComponent(token)}/accept`, { signal })
}
