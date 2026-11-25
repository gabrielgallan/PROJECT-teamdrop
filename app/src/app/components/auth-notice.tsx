import { useAuth } from '../../hooks/use-auth'

export function AuthNotice() {
	const auth = useAuth()
	if (!auth.error) return null
	return <div role="alert" className="px-4 py-2 text-xs text-red-300">
		<p>{auth.error}</p>
		<button type="button" disabled={auth.busy !== null} className="mt-2 underline"
			onClick={() => void (auth.needsLogin ? auth.logout() : auth.retry())}>
			{auth.needsLogin ? 'Entrar novamente' : 'Tentar novamente'}
		</button>
	</div>
}
