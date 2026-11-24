import type { ApiFile, ApiFileWithAuthor, TeamFile } from '../types/file'
import { ApiError, apiRequest, apiUrl, responseData } from './api'

export interface FilesPage { files: ApiFileWithAuthor[]; nextCursor: string | null }

export function listFiles(teamId: string, cursor?: string, signal?: AbortSignal) {
	const query = new URLSearchParams({ limit: '10' })
	if (cursor) query.set('cursor', cursor)
	return apiRequest<FilesPage>(`/api/teams/${encodeURIComponent(teamId)}/files?${query}`, { signal })
}

export async function uploadFile(teamId: string, file: File, signal?: AbortSignal) {
	const body = new FormData()
	body.append('file', file)
	return (await apiRequest<{ file: ApiFile }>(`/api/teams/${encodeURIComponent(teamId)}/files`, {
		method: 'POST', body, signal, timeoutMs: 120_000,
	})).file
}

export async function generateFileUrl(fileId: string) {
	const response = await fetch(`${apiUrl}/api/files/${encodeURIComponent(fileId)}/url`, {
		cache: 'no-store', signal: AbortSignal.timeout(15_000),
	})
	return (await responseData<{ url: string }>(response)).url
}

export function fileView(file: ApiFileWithAuthor, teamId: string): TeamFile {
	const name = file.author.name?.trim() || file.author.email
	const units = ['B', 'KB', 'MB', 'GB', 'TB']
	const unit = file.size > 0 ? Math.min(Math.floor(Math.log(file.size) / Math.log(1024)), units.length - 1) : 0
	return {
		id: file.id, teamId, name: file.name, mimeType: file.mimeType,
		size: `${Number((file.size / 1024 ** unit).toFixed(unit > 0 ? 1 : 0))} ${units[unit]}`,
		createdAt: new Date(file.createdAt).getTime(),
		kind: file.mimeType.startsWith('image/') ? 'image' : 'document',
		member: {
			id: file.author.email, name, avatarUrl: file.author.avatarUrl ?? undefined,
			initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
			color: 'bg-indigo-400/15 text-indigo-100',
		},
	}
}

export function fileError(error: unknown): string {
	if (error instanceof ApiError) {
		if (error.status === 404) return 'O arquivo ou o acesso ao time não está mais disponível.'
		if (error.status === 413) return 'O arquivo excede o tamanho aceito pelo servidor.'
		if (error.status === 401) return 'Sua sessão precisa ser renovada. Entre novamente se necessário.'
		if (error.status === 503 || error.status === 502) return 'O armazenamento está indisponível. Tente novamente.'
	}
	return 'Não foi possível concluir a operação. Verifique a conexão e tente novamente.'
}
