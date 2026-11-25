import { queryOptions } from '@tanstack/react-query'
import { queryKeys } from '../query-keys'
import { getUserTeams } from './get-user-teams'

export const userTeamsQuery = (userId: string) =>
	queryOptions({
		queryKey: queryKeys.teams(userId),
		queryFn: ({ signal }) => getUserTeams(signal),
	})
