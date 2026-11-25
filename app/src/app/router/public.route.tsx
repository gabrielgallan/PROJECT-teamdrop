import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '../../hooks/use-session'

export function PublicRoute() {
	const { session, status } = useSession()
	const location = useLocation()
	if (status === 'restoring') return <p role="status" className="p-8 text-sm">Restaurando sessão…</p>
	if (session) {
		const from = location.state?.from
		return <Navigate to={typeof from === 'string' && from.startsWith('/') && from !== '/login' ? from : '/'} replace />
	}
	return <Outlet />
}
