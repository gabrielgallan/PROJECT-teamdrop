import { authCommands } from '../desktop/auth.commands'
import { handleAuthFailure } from '../auth/auth.errors'
import { authStore } from '../auth/auth.store'
import { env } from '../env'
import { createApiClient } from './api-client'

export const api = createApiClient({
	baseUrl: env.VITE_API_URL,
	getAccessToken: authCommands.getAccessToken,
	getSession: () => authStore.getSnapshot().session,
	canRequest: () => {
		const state = authStore.getSnapshot()
		return state.status === 'authenticated' && !state.needsLogin && state.busy === null
	},
	onAuthFailure: handleAuthFailure,
})
