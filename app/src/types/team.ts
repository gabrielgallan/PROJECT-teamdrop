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
	storageRetentionSeconds: number
	createdAt: string
	updatedAt: string
	role: 'owner' | 'member'
}

export interface InviteTeam extends Omit<Team, 'role'> {
	role: Team['role'] | 'invited'
}

export interface TeamMember {
	id: string
	name: string | null
	email: string
	avatarUrl: string | null
	role: 'owner' | 'member'
}
