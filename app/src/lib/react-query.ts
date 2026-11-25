import { QueryClient } from '@tanstack/react-query'
import { ApiError, isCancelled } from './api-error'

export function retryQuery(failures: number, error: unknown) {
	if (isCancelled(error)) return false
	if (error instanceof ApiError) return error.status >= 500 && failures < 2
	if (error && typeof error === 'object' && 'code' in error) return false
	return failures < 2
}

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: 30_000, retry: retryQuery },
		mutations: { retry: false },
	},
})
