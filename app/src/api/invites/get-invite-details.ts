import { api } from '../../lib/ky'
import type { InviteTeam } from '../../types/team'

export interface GetInviteDetailsRequest {
	token: string
}

export type GetInviteDetailsResponse = InviteTeam

export async function getInviteDetails(
	{ token }: GetInviteDetailsRequest,
	signal?: AbortSignal,
) {
	const response = await api
		.get(`api/invites/${encodeURIComponent(token)}`, { signal })
		.json<GetInviteDetailsResponse>()
	return response
}
