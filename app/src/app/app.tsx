import '../global.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { domMax, LazyMotion, MotionConfig } from 'motion/react'
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
			<MotionConfig
				reducedMotion="user"
				transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
			>
				<LazyMotion features={domMax} strict>
					<MemoryRouter>
						<Router />
					</MemoryRouter>
				</LazyMotion>
			</MotionConfig>
		</QueryClientProvider>
	)
}
