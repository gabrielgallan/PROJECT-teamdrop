interface CreateTeamServiceInput {
	name: string
	userId: string
	storageRetentionSeconds?: number
}

interface ListUserTeamsServiceInput {
	userId: string
}

interface UpdateTeamServiceInput {
	userId: string
	teamId: string
	name?: string
	storageRetentionSeconds?: number
}

interface ListTeamMembersServiceInput {
	userId: string
	teamId: string
}

interface LeaveTeamServiceInput {
	userId: string
	teamId: string
}

interface RemoveMemberServiceInput {
	userId: string
	teamId: string
	memberId: string
}

export type {
	CreateTeamServiceInput,
	LeaveTeamServiceInput,
	ListTeamMembersServiceInput,
	ListUserTeamsServiceInput,
	RemoveMemberServiceInput,
	UpdateTeamServiceInput,
}
