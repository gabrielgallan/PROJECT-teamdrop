import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '../../hooks/use-session'
import { ProfileSkeleton } from '../components/skeleton'

export function PrivateRoute() {
	const { session, status } = useSession()
	const location = useLocation()
	if (status === 'restoring')
		return (
			<ProfileSkeleton
				label="Restaurando sessão…"
				className="h-full justify-center bg-zinc-900/50 p-8"
			/>
		)
	if (!session)
		return <Navigate to="/login" replace state={{ from: location.pathname }} />
	return <Outlet />
}
