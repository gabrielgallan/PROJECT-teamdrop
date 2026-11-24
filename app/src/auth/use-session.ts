import { useSyncExternalStore } from 'react'
import {
	cancelLogin,
	restoreSession,
	signInWithGoogle,
	signOut,
} from './index'
import { authStore } from './auth.store'

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