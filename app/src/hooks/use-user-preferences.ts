import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../api/query-keys'
import { authStore } from '../auth/auth.store'
import { isDesktop } from '../desktop/app.commands'
import { preferencesCommands } from '../desktop/preferences.commands'
import { useAuth } from './use-auth'

export function useUserPreferences() {
	const { user, session } = useAuth()
	const client = useQueryClient()
	const supported = isDesktop()
	const queryKey = queryKeys.preferences(user.id)
	const query = useQuery({
		queryKey,
		enabled: supported,
		staleTime: Infinity,
		retry: false,
		queryFn: async ({ signal }) => {
			const result = await preferencesCommands.read(user.id)
			signal.throwIfAborted()
			return result
		},
	})
	const mutation = useMutation({
		mutationFn: async (autoDrop: boolean) => {
			if (!supported || authStore.getSnapshot().session !== session) {
				throw new DOMException('Session changed', 'AbortError')
			}
			await preferencesCommands.write(user.id, { autoDrop })
			return { autoDrop }
		},
		onSuccess: (preferences) => {
			if (authStore.getSnapshot().session === session) {
				client.setQueryData(queryKey, preferences)
			}
		},
	})
	return {
		autoDrop: query.data?.autoDrop ?? false,
		ready: supported && query.isSuccess,
		loading: supported && query.isPending,
		supported,
		saving: mutation.isPending,
		error: query.error
			? 'Não foi possível carregar suas preferências. O envio manual continua disponível.'
			: mutation.error
				? 'Não foi possível salvar a preferência. Tente novamente.'
				: '',
		setAutoDrop: (value: boolean) => {
			if (!mutation.isPending && query.isSuccess) mutation.mutate(value)
		},
		retry: () => {
			void query.refetch()
		},
	}
}
