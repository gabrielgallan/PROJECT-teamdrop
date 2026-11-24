import { Navigate, Outlet } from 'react-router'
import { useSession } from '../hooks/use-session'

export function PrivateRoute() {
	const { session } = useSession()

	if (!session) {
		return <Navigate to="/login" replace />
	}

	return <Outlet />
}