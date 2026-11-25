import { api } from '../../lib/ky'

export interface RemoveTeamMemberRequest {
	teamId: string
	memberId: string
}

export async function removeTeamMember(
	{ teamId, memberId }: RemoveTeamMemberRequest,
	signal?: AbortSignal,
) {
	await api.delete(
		`api/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberId)}`,
		{ signal },
	)
}
