import { queryKeys } from '../query-keys'
import { useAccountMutation } from '../use-account-mutation'
import { acceptTeamInvite } from './accept-team-invite'

export const useAcceptTeamInvite = () =>
	useAccountMutation(
		({ token }: { token: string; teamId: string }) =>
			acceptTeamInvite({ token }),
		async (client, _data, { token, teamId }, userId) => {
			await Promise.all([
				client.invalidateQueries({
					queryKey: queryKeys.teams(userId),
					exact: true,
				}),
				client.invalidateQueries({
					queryKey: queryKeys.members(userId, teamId),
				}),
				client.invalidateQueries({ queryKey: queryKeys.invite(userId, token) }),
			])
		},
	)
