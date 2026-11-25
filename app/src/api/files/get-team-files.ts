import { api } from '../../lib/ky'
import type { ApiFileWithAuthor } from '../../types/file'

export interface GetTeamFilesRequest {
	teamId: string
	cursor?: string
	limit?: number
}

export interface GetTeamFilesResponse {
	files: ApiFileWithAuthor[]
	nextCursor: string | null
}

export async function getTeamFiles(
	{ teamId, cursor, limit = 10 }: GetTeamFilesRequest,
	signal?: AbortSignal,
) {
	const response = await api.get(`api/teams/${encodeURIComponent(teamId)}/files`, {
		searchParams: { limit, ...(cursor ? { cursor } : {}) }, signal,
	}).json<GetTeamFilesResponse>()
	return response
}
