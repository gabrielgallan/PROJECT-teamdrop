import { Loader2, Package } from 'lucide-react'
import { FaGoogle } from 'react-icons/fa'
import { useSession } from '../../hooks/use-session'
import { ProfileSkeleton } from '../components/skeleton'

export function LoginScreen() {
	const { status, busy, error, needsLogin, login, retry } = useSession()

	const isRestoring = busy === 'restore'
	const isAuthenticating = busy === 'login'
	const isUnsupported = status === 'unsupported'
	const isRecoverable = status === 'recoverable'

	const canLogin = !isUnsupported && (!isRecoverable || needsLogin)
	const canRetry = isRecoverable && !needsLogin

	return (
		<main className="flex h-full flex-col justify-center overflow-y-auto bg-zinc-950/55 p-8 text-white/90">
			<Package className="mx-auto size-14 stroke-[1.5]" />

			{isRestoring ? (
				<ProfileSkeleton
					label="Restaurando sessão…"
					className="mt-8 justify-center"
				/>
			) : (
				<div className="mt-8 space-y-4">
					{canLogin && (
						<button
							type="button"
							onClick={() => void login()}
							disabled={busy !== null}
							className="flex w-full items-center justify-center gap-2 bg-white/5 py-2 hover:bg-white/10"
						>
							{isAuthenticating ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<>
									<FaGoogle />
									Entrar com Google
								</>
							)}
						</button>
					)}

					{canRetry && (
						<button
							type="button"
							onClick={() => void retry()}
							disabled={busy !== null}
							className="w-full bg-white/5 py-3 hover:bg-white/10"
						>
							Tentar novamente
						</button>
					)}

					{error && (
						<p role="alert" className="text-sm text-red-300">
							{error}
						</p>
					)}
				</div>
			)}
		</main>
	)
}
