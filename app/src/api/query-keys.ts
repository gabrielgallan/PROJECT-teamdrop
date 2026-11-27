export const queryKeys = {
	account: (userId: string) => ['account', userId] as const,
	preferences: (userId: string) =>
		[...queryKeys.account(userId), 'preferences'] as const,
	realtime: (userId: string) =>
		[...queryKeys.account(userId), 'realtime'] as const,
	teams: (userId: string) => [...queryKeys.account(userId), 'teams'] as const,
	team: (userId: string, teamId: string) =>
		[...queryKeys.teams(userId), teamId] as const,
	members: (userId: string, teamId: string) =>
		[...queryKeys.team(userId, teamId), 'members'] as const,
	files: (userId: string, teamId: string, limit = 10) =>
		[...queryKeys.team(userId, teamId), 'files', { limit }] as const,
	invite: (userId: string, token: string) =>
		[...queryKeys.account(userId), 'invites', token] as const,
	fileUrl: (userId: string, teamId: string, fileId: string) =>
		[...queryKeys.team(userId, teamId), 'file-url', fileId] as const,
	fileArrivals: (userId: string, teamId: string) =>
		[...queryKeys.team(userId, teamId), 'file-arrivals'] as const,
}
