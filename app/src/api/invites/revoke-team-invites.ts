import { api } from '../../lib/ky'

export interface RevokeTeamInvitesRequest {
	teamId: string
}

export async function revokeTeamInvites(
	{ teamId }: RevokeTeamInvitesRequest,
	signal?: AbortSignal,
) {
	await api.delete('api/invites', { json: { teamId }, signal })
}
