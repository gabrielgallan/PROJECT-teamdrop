import { useSyncExternalStore } from 'react'
import { authStore } from '../auth/auth.store'
import {
	cancelLogin,
	restoreSession,
	signInWithGoogle,
	signOut,
} from '../auth/session'

export function useSession() {
	const state = useSyncExternalStore(authStore.subscribe, authStore.getSnapshot)

	return {
		...state,
		login: signInWithGoogle,
		logout: signOut,
		cancel: cancelLogin,
		retry: restoreSession,
	}
}
