import { FaGithub, FaGoogle } from 'react-icons/fa'
import { Separator } from '../components/separator'

export function LoginScreen({ onContinue }: { onContinue: () => void }) {
	function handleSignIn() {
		onContinue()
	}

	return (
		<main className="flex h-full flex-col justify-center overflow-y-auto bg-zinc-950/55 p-8 text-white/90">
			<form className="mt-8 space-y-4" onSubmit={handleSignIn}>
				<div>
					<label htmlFor="login-email" className="mb-2 block text-xs text-white/75">
						E-mail
					</label>
					<input
						id="login-email"
						name="email"
						type="email"
						autoComplete="email"
						required
						placeholder="voce@empresa.com"
						className="h-8 w-full border border-white/10 bg-white/5 px-3 text-sm placeholder:text-white/50"
					/>
				</div>

				<button
					type="submit"
					className="flex h-8 w-full items-center justify-center gap-2 bg-indigo-400 transition-colors duration-200 text-zinc-950 hover:bg-indigo-400/70"
				>
					Entrar
				</button>

				<Separator />

				<button
					type="submit"
					className="w-full flex gap-2 items-center justify-center bg-white/5 py-2 hover:bg-white/10"
				>
					<FaGoogle />
				</button>
				<button
					type="submit"
					className="w-full flex gap-2 items-center justify-center bg-white/5 py-2 hover:bg-white/10"
				>
					<FaGithub />
				</button>
			</form>
		</main>
	)
}
