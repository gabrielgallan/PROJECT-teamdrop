import { queryOptions } from '@tanstack/react-query'
import { getUserTeams } from './get-user-teams'
import { queryKeys } from '../query-keys'

export const userTeamsQuery = (userId: string) => queryOptions({
	queryKey: queryKeys.teams(userId),
	queryFn: ({ signal }) => getUserTeams(signal),
})
