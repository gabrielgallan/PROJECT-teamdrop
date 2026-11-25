import { api } from '../../lib/ky'
import type { ApiFile } from '../../types/file'

export interface UploadTeamFileRequest {
	teamId: string
	file: File
}
export interface UploadTeamFileResponse {
	file: ApiFile
}

export async function uploadTeamFile({ teamId, file }: UploadTeamFileRequest, signal?: AbortSignal) {
	const body = new FormData()
	body.append('file', file)
	const response = await api.post(`api/teams/${encodeURIComponent(teamId)}/files`, {
		body, signal, timeout: 120_000,
	}).json<UploadTeamFileResponse>()
	return response
}
