import { useState, useSyncExternalStore } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useSession } from '../auth/use-session'
import { useTeamSettings } from '../hooks/use-team-settings'
import { AcceptInviteScreen } from '../screens/accept-invite-screen'
import { DropsScreen } from '../screens/drops'
import {
	getPendingInvite,
	setPendingInvite,
	subscribeInvites,
} from '../services/invites'
import type { SessionUser } from '../auth/auth.types'

export function WorkspaceLayout() {
	const { session } = useSession()

	if (!session) {
		return <Navigate to="/login" replace />
	}

	return (
		<Workspace
			key={session.user.id}
			user={session.user}
		/>
	)
}

function Workspace({ user }: { user: SessionUser }) {
	const auth = useSession()
	const teams = useTeamSettings(user)
	const [settingsOpen, setSettingsOpen] = useState(false)

	const pending = useSyncExternalStore(
		subscribeInvites,
		getPendingInvite,
	)

	function logout() {
		setPendingInvite(null)
		void auth.logout()
	}

	function closeInvite() {
		setPendingInvite(null)
		setSettingsOpen(true)
	}

	return (
		<Routes>
			<Route
				index
				element={
					pending !== null ? (
						<Navigate to="/invites/accept" replace />
					) : (
						<DropsScreen
							user={user}
							onLogout={logout}
							authBusy={auth.busy !== null}
							authError={auth.error}
							authNeedsLogin={auth.needsLogin}
							onAuthRetry={auth.needsLogin ? logout : auth.retry}
							teamSettings={teams}
							settingsOpen={settingsOpen}
							onSettingsChange={setSettingsOpen}
						/>
					)
				}
			/>

			<Route
				path="invites/accept"
				element={
					pending !== null ? (
						<AcceptInviteScreen
							key={pending}
							token={pending}
							onClose={closeInvite}
							onAccepted={teams.includeTeam}
						/>
					) : (
						<Navigate to="/" replace />
					)
				}
			/>

			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	)
}