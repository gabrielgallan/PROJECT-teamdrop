import type { Member } from './team'

export interface ApiFile {
	id: string
	name: string
	mimeType: string
	size: number
	createdAt: string
}

export interface ApiFileWithAuthor extends ApiFile {
	author: { name: string | null; email: string; avatarUrl: string | null }
}

export interface TeamFile {
	id: string
	teamId: string
	name: string
	mimeType: string
	size: string
	createdAt: number
	member: Member
	kind: 'image' | 'document'
}
