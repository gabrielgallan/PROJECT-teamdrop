import { api } from '../../lib/ky'

export interface GetFileUrlRequest {
	fileId: string
	type: 'preview' | 'download'
}

export interface GetFileUrlResponse {
	url: string
}

export async function getFileUrl(
	{ fileId, type }: GetFileUrlRequest,
	signal?: AbortSignal,
) {
	const response = await api
		.post(`api/files/${encodeURIComponent(fileId)}/url`, {
			searchParams: { type },
			signal,
		})
		.json<GetFileUrlResponse>()
	return response
}
