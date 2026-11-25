import '../global.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { MemoryRouter } from 'react-router'
import { initializeAuthCache } from '../api/session-cache'
import { initializeSession } from '../auth/session'
import { initializeInvites } from '../desktop/invite-links'
import { queryClient } from '../lib/react-query'
import { Router } from './router/index'

export function App() {
	useEffect(() => {
		const unsubscribe = initializeAuthCache()
		void initializeSession()
		void initializeInvites()
		return unsubscribe
	}, [])

	return (
		<QueryClientProvider client={queryClient}>
			<MemoryRouter>
				<Router />
			</MemoryRouter>
		</QueryClientProvider>
	)
}
