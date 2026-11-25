import { queryKeys } from '../query-keys'
import { useAccountMutation } from '../use-account-mutation'
import { acceptTeamInvite } from './accept-team-invite'

export const useAcceptTeamInvite = () =>
	useAccountMutation(
		acceptTeamInvite,
		async (client, { team }, { token }, userId) => {
			await Promise.all([
				client.invalidateQueries({
					queryKey: queryKeys.teams(userId),
					exact: true,
				}),
				client.invalidateQueries({
					queryKey: queryKeys.members(userId, team.id),
				}),
				client.invalidateQueries({ queryKey: queryKeys.invite(userId, token) }),
			])
		},
	)
