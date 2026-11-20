import './styles/global.css'
import { useSession } from './hooks/use-session'
import { DropsScreen } from './screens/drops-screen'
import { LoginScreen } from './screens/login-screen'

export function App() {
	const { session, status, login, logout, busy, error, cancel, retry, needsLogin } = useSession()
	if (session) {
		return (
			<DropsScreen
				user={session.user}
				onLogout={logout}
				authBusy={busy !== null}
				authError={error}
				authNeedsLogin={needsLogin}
				onAuthRetry={needsLogin ? logout : retry}
			/>
		)
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
