import { api } from '../../lib/ky'

export interface GetFileUrlRequest {
	fileId: string
}

export interface GetFileUrlResponse {
	url: string
}

export async function getFileUrl({ fileId }: GetFileUrlRequest, signal?: AbortSignal) {
	const response = await api
		.get(`api/files/${encodeURIComponent(fileId)}/url`, { signal, context: { public: true } })
		.json<GetFileUrlResponse>()
	return response
}
