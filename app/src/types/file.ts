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

export interface SharedFile {
	isNew?: boolean
	id: string
	teamId: string
	name: string
	size: string
	member: Member
	createdAt: number
	expiresAt: number
	url: string
	link: string
	kind: 'image' | 'document'
	text?: string
}

export interface PendingFile {
	id: string
	name: string
	file?: File
	path?: string
	kind: 'image' | 'document'
	url?: string
}
