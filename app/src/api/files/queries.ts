import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { getFileUrl } from './get-file-url'
import { getTeamFiles } from './get-team-files'
import { queryKeys } from '../query-keys'

export const teamFilesQuery = (userId: string, teamId: string, limit = 10) =>
	infiniteQueryOptions({
		queryKey: queryKeys.files(userId, teamId, limit),
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam, signal }) => getTeamFiles({ teamId, limit, cursor: pageParam }, signal),
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	})

export const fileUrlQuery = (userId: string, teamId: string, fileId: string) =>
	queryOptions({
		queryKey: queryKeys.fileUrl(userId, teamId, fileId),
		queryFn: async ({ signal }) => {
			const startedAt = Date.now()
			const { url } = await getFileUrl({ fileId }, signal)
			return { url, expiresAt: startedAt + 5 * 60_000 }
		},
		staleTime: Infinity,
		gcTime: 0,
		refetchOnMount: 'always',
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	})
