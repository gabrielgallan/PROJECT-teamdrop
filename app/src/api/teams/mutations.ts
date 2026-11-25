import { createTeam } from './create-team'
import type { GetUserTeamsResponse } from './get-user-teams'
import { leaveTeam } from './leave-team'
import { removeTeamMember } from './remove-team-member'
import { updateTeam } from './update-team'
import { queryKeys } from '../query-keys'
import { useAccountMutation } from '../use-account-mutation'

export const useCreateTeam = () =>
	useAccountMutation(createTeam, (client, { team }, _variables, userId) => {
		void client.cancelQueries({ queryKey: queryKeys.teams(userId), exact: true })
		client.setQueryData<GetUserTeamsResponse>(queryKeys.teams(userId), (previous) => ({
			teams: [team, ...(previous?.teams.filter((value) => value.id !== team.id) ?? [])],
		}))
		return client.invalidateQueries({ queryKey: queryKeys.teams(userId), exact: true })
	})

export const useUpdateTeam = () =>
	useAccountMutation(updateTeam, (client, { team }, _variables, userId) => {
		void client.cancelQueries({ queryKey: queryKeys.teams(userId), exact: true })
		client.setQueryData<GetUserTeamsResponse>(
			queryKeys.teams(userId),
			(previous) =>
				previous && { teams: previous.teams.map((value) => (value.id === team.id ? team : value)) },
		)
		return client.invalidateQueries({ queryKey: queryKeys.teams(userId), exact: true })
	})

export const useLeaveTeam = () =>
	useAccountMutation(leaveTeam, (client, _data, { teamId }, userId) => {
		void client.cancelQueries({ queryKey: queryKeys.team(userId, teamId) })
		client.removeQueries({ queryKey: queryKeys.team(userId, teamId) })
		void client.cancelQueries({ queryKey: queryKeys.teams(userId), exact: true })
		client.setQueryData<GetUserTeamsResponse>(
			queryKeys.teams(userId),
			(previous) => previous && { teams: previous.teams.filter((team) => team.id !== teamId) },
		)
		return client.invalidateQueries({ queryKey: queryKeys.teams(userId), exact: true })
	})

export const useRemoveTeamMember = () =>
	useAccountMutation(removeTeamMember, (client, _data, { teamId }, userId) =>
		client.invalidateQueries({ queryKey: queryKeys.members(userId, teamId) }),
	)
