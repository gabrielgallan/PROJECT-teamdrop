interface CreateTeamInviteServiceInput {
	userId: string
	teamId: string
	maxUses: number
	expiresIn: number
}

interface RevokeTeamInvitesServiceInput {
	userId: string
	teamId: string
}

interface GetInviteDetailsServiceInput {
	userId: string
	token: string
}

interface AcceptTeamInviteServiceInput {
	userId: string
	token: string
}

export type {
	AcceptTeamInviteServiceInput,
	CreateTeamInviteServiceInput,
	GetInviteDetailsServiceInput,
	RevokeTeamInvitesServiceInput,
}
