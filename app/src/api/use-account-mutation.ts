import {
	type QueryClient,
	useMutation,
	useQueryClient,
} from '@tanstack/react-query'
import { authStore } from '../auth/auth.store'
import { useAuth } from '../hooks/use-auth'

export function useAccountMutation<TData, TVariables>(
	mutationFn: (variables: TVariables) => Promise<TData>,
	onSuccess?: (
		client: QueryClient,
		data: TData,
		variables: TVariables,
		userId: string,
	) => Promise<unknown> | undefined,
) {
	const { session } = useAuth()
	const client = useQueryClient()
	return useMutation({
		mutationFn: async (variables: TVariables) => {
			const state = authStore.getSnapshot()
			if (
				state.session !== session ||
				state.needsLogin ||
				state.busy !== null
			) {
				throw new DOMException('Session unavailable', 'AbortError')
			}
			return mutationFn(variables)
		},
		onSuccess: async (data, variables) => {
			const state = authStore.getSnapshot()
			if (state.session !== session || state.busy === 'logout') return
			await onSuccess?.(client, data, variables, session.user.id)
		},
	})
}
