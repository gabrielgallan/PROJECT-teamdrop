import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '../../hooks/use-session'
import { ProfileSkeleton } from '../components/skeleton'

export function PublicRoute() {
	const { session, status } = useSession()
	const location = useLocation()
	if (status === 'restoring') return <ProfileSkeleton label="Restaurando sessão…" className="h-full justify-center bg-zinc-900/50 p-8" />
	if (session) {
		const from = location.state?.from
		return <Navigate to={typeof from === 'string' && from.startsWith('/') && from !== '/login' ? from : '/'} replace />
	}
	return <Outlet />
}
