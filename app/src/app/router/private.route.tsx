import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '../../hooks/use-session'

export function PrivateRoute() {
	const { session, status } = useSession()
	const location = useLocation()
	if (status === 'restoring') return <p role="status" className="p-8 text-sm">Restaurando sessão…</p>
	if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
	return <Outlet />
}
