import { useState } from 'react'
import { currentUser } from '../mocks/team'
import type { Member } from '../types/team'

export function useSession() {
	const [session, setSession] = useState<{ user: Member } | null>(null)

	return {
		session,
		enterDemo: () => setSession({ user: currentUser }),
	}
}
