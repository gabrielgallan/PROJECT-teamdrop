import { useSyncExternalStore } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { getPendingInvite, subscribeInvites } from '../../desktop/invite-links'
import { useAuth } from '../../hooks/use-auth'
import { useRestoreFocus } from '../../hooks/use-navigation'
import { WorkspaceProvider } from '../providers/workspace.provider'

export function WorkspaceLayout() {
	const { user } = useAuth()
	return (
		<WorkspaceProvider key={user.id}>
			<Workspace />
		</WorkspaceProvider>
	)
}

function Workspace() {
	const pending = useSyncExternalStore(subscribeInvites, getPendingInvite)
	const location = useLocation()
	useRestoreFocus()
	const invitePath = pending ? `/invites/${encodeURIComponent(pending)}/accept` : null
	return invitePath && location.pathname !== invitePath ? (
		<Navigate to={invitePath} replace />
	) : (
		<Outlet />
	)
}
