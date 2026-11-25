import { authStore } from '../auth/auth.store'
import { setPendingInvite } from '../desktop/invite-links'
import { queryClient } from '../lib/react-query'

export function initializeAuthCache() {
	let previous = authStore.getSnapshot()
	return authStore.subscribe(() => {
		const next = authStore.getSnapshot()
		const changedAccount = previous.session?.user.id !== next.session?.user.id
		const loggingOut = next.busy === 'logout' && previous.busy !== 'logout'
		if (changedAccount || loggingOut) {
			void queryClient.cancelQueries()
			queryClient.clear()
			if (loggingOut || previous.session) setPendingInvite(null)
		} else if (next.needsLogin && !previous.needsLogin) {
			void queryClient.cancelQueries()
		}
		previous = next
	})
}
