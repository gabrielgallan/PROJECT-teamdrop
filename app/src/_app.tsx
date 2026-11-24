import './styles/global.css'
import { useEffect } from 'react'
import {
	initializeInvites,
} from './services/invites'
import { initializeSession } from './auth'
import { MemoryRouter } from 'react-router'
import { Router } from './router/index'

export function App() {
	useEffect(() => {
		void initializeSession()
		void initializeInvites()
	}, [])

	return (
		<MemoryRouter>
			<Router />
		</MemoryRouter>
	)
}