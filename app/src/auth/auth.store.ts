import type { AuthSnapshot } from './auth.types'

let snapshot: AuthSnapshot = {
	status: 'restoring',
	session: null,
	busy: 'restore',
	error: '',
	needsLogin: false,
}

const listeners = new Set<() => void>()

function getSnapshot() {
	return snapshot
}

function subscribe(listener: () => void) {
	listeners.add(listener)

	return () => {
		listeners.delete(listener)
	}
}

function update(next: Partial<AuthSnapshot>) {
	snapshot = { ...snapshot, ...next }

	for (const listener of listeners) {
		listener()
	}
}

export const authStore = {
	getSnapshot,
	subscribe,
	update,
}
