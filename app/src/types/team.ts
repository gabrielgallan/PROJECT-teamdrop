export interface Member {
	id: string
	name: string
	initials: string
	avatarUrl?: string
	color: string
}

export interface Team {
	id: string
	name: string
	members: number
}

export interface SettingsTeam {
	id: string
	name: string
	role: 'owner' | 'member'
}

export interface TeamSettingsMember extends Member {
	role: 'owner' | 'member'
}

export interface TeamSettings extends SettingsTeam {
	members: TeamSettingsMember[]
	inviteUrl: string | null
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
