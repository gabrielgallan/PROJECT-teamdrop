import { useSession } from './use-session'

export function useAuth() {
	const auth = useSession()

	if (!auth.session) {
		throw new Error('Authenticated session required')
	}

	return {
		...auth,
		session: auth.session,
		user: auth.session.user,
	}
}