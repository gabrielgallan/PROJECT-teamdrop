import { Package } from 'lucide-react'
import { FaGoogle } from 'react-icons/fa'

export function LoginScreen({
	onContinue,
	busy,
	error,
	onCancel,
	restoring = false,
	recoverable = false,
	unsupported = false,
	needsLogin = false,
	onRetry,
}: {
	onContinue: () => void
	busy: boolean
	error: string
	onCancel: () => void
	restoring?: boolean
	recoverable?: boolean
	unsupported?: boolean
	needsLogin?: boolean
	onRetry: () => void
}) {
	return (
		<main className="flex flex-col h-full justify-center overflow-y-auto bg-zinc-950/55 p-8 text-white/90">
			<Package className="mx-auto size-14 stroke-[1.5]" />

			{restoring ? (
				<p role="status" className="mt-8 text-center text-sm text-white/70">
					Restaurando sessão…
				</p>
			) : (
				<form
					className="mt-8 space-y-4"
					onSubmit={(event) => {
						event.preventDefault()
						if (!unsupported && (!recoverable || needsLogin)) onContinue()
					}}
				>
					{!unsupported && (!recoverable || needsLogin) && (
						<button
							type="submit"
							disabled={busy}
							className="w-full flex gap-2 items-center justify-center bg-white/5 py-3 hover:bg-white/10"
						>
							<FaGoogle />{' '}
							{busy
								? 'Aguardando login…'
								: needsLogin
									? 'Entrar novamente com Google'
									: 'Entrar com Google'}
						</button>
					)}
					{recoverable && !needsLogin && (
						<button
							type="button"
							onClick={onRetry}
							className="w-full bg-white/5 py-3 hover:bg-white/10"
						>
							Tentar novamente
						</button>
					)}
					{busy && (
						<>
							<p role="status" className="text-sm text-white/70">
								Conclua o login no navegador e volte ao Teamdrop.
							</p>
							<button type="button" onClick={onCancel} className="w-full py-2">
								Cancelar
							</button>
						</>
					)}
					{error && (
						<p role="alert" className="text-sm text-red-300">
							{error}
						</p>
					)}
				</form>
			)}
		</main>
	)
}
