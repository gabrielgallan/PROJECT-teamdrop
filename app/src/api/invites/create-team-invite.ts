import { api } from '../../lib/ky'

export interface CreateTeamInviteRequest {
	teamId: string
	maxUses?: number
	expiresIn?: number
}

export interface CreateTeamInviteResponse {
	url: string
}

export async function createTeamInvite(
	{ teamId, maxUses, expiresIn }: CreateTeamInviteRequest,
	signal?: AbortSignal,
) {
	const response = await api
		.post('api/invites', { json: { teamId, maxUses, expiresIn }, signal })
		.json<CreateTeamInviteResponse>()
	return response
}
