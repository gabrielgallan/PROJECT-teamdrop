import { useEffect, useSyncExternalStore } from 'react'
import {
	cancelLogin,
	getSessionSnapshot,
	initializeSession,
	restoreSession,
	signInWithGoogle,
	signOut,
	subscribeSession,
} from '../services/auth'

export function useSession() {
	const state = useSyncExternalStore(subscribeSession, getSessionSnapshot)
	useEffect(() => {
		void initializeSession()
	}, [])
	return {
		...state,
		login: signInWithGoogle,
		logout: signOut,
		cancel: cancelLogin,
		retry: restoreSession,
	}
}
