import './styles/global.css'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useSession } from './hooks/use-session'
import { useTeamSettings } from './hooks/use-team-settings'
import { AcceptInviteScreen } from './screens/accept-invite-screen'
import { DropsScreen } from './screens/drops-screen'
import { LoginScreen } from './screens/login-screen'
import {
	getPendingInvite,
	initializeInvites,
	setPendingInvite,
	subscribeInvites,
} from './services/invites'
import type { SessionUser } from './types/auth'

export function App() {
	const auth = useSession()
	const { session, status, login, busy, error, cancel, retry, needsLogin } = auth
	useEffect(() => {
		void initializeInvites()
	}, [])
	if (session) {
		return <Workspace key={session.user.id} user={session.user} auth={auth} />
	}
	return (
		<LoginScreen
			onContinue={login}
			busy={busy === 'login'}
			error={error}
			onCancel={cancel}
			restoring={busy === 'restore'}
			recoverable={status === 'recoverable'}
			unsupported={status === 'unsupported'}
			needsLogin={needsLogin}
			onRetry={retry}
		/>
	)
}

function Workspace({ user, auth }: { user: SessionUser; auth: ReturnType<typeof useSession> }) {
	const teams = useTeamSettings(user)
	const [settingsOpen, setSettingsOpen] = useState(false)
	const pending = useSyncExternalStore(subscribeInvites, getPendingInvite)
	const logout = () => {
		setPendingInvite(null)
		void auth.logout()
	}
	if (pending !== null)
		return (
			<AcceptInviteScreen
				key={pending}
				token={pending}
				onClose={() => {
					setPendingInvite(null)
					setSettingsOpen(true)
				}}
				onAccepted={teams.includeTeam}
			/>
		)
	return (
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
