import './styles/global.css'
import { useSession } from './hooks/use-session'
import { DropsScreen } from './screens/drops-screen'
import { LoginScreen } from './screens/login-screen'

export function App() {
	const { session, enterDemo } = useSession()

	return session ? <DropsScreen /> : <LoginScreen onContinue={enterDemo} />
}
