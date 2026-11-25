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
	slug: string
	role: 'owner' | 'member'
}

export interface TeamMember {
	id: string
	name: string | null
	email: string
	avatarUrl: string | null
	role: 'owner' | 'member'
}
