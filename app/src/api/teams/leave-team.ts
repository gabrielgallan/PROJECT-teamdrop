import { api } from '../../lib/ky'

export interface LeaveTeamRequest {
	teamId: string
}

export async function leaveTeam(
	{ teamId }: LeaveTeamRequest,
	signal?: AbortSignal,
) {
	await api.delete(`api/teams/${encodeURIComponent(teamId)}/members/me`, { signal })
}
