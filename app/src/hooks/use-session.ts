import { useSyncExternalStore } from 'react'
import {
	cancelLogin,
	restoreSession,
	signInWithGoogle,
	signOut,
} from '../auth/session'
import { authStore } from '../auth/auth.store'

export function useSession() {
	const state = useSyncExternalStore(
		authStore.subscribe,
		authStore.getSnapshot,
	)

	return {
		...state,
		login: signInWithGoogle,
		logout: signOut,
		cancel: cancelLogin,
		retry: restoreSession,
	}
}