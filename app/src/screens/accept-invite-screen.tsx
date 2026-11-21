import { ArrowLeft, Box, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { parseInviteLink, setPendingInvite } from '../services/invites'
import type { ApiTeam, InvitePreview } from '../services/teams'
import { acceptInvite, previewInvite, teamError } from '../services/teams'

export function AcceptInviteScreen({
	token,
	onClose,
	onAccepted,
}: {
	token: string
	onClose: () => void
	onAccepted: (team: ApiTeam) => void
}) {
	const [link, setLink] = useState('')
	const [preview, setPreview] = useState<InvitePreview | null>(null)
	const [loading, setLoading] = useState(Boolean(token))
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')
	const [attempt, setAttempt] = useState(0)
	const locked = useRef(false)
	const active = useRef(false)
	const input = useRef<HTMLInputElement>(null)
	const back = useRef<HTMLButtonElement>(null)
	useEffect(() => {
		active.current = true
		const controller = new AbortController()
		if (!token) input.current?.focus()
		else {
			back.current?.focus()
			setLoading(true)
			setError('')
			void previewInvite(token, controller.signal)
				.then((value) => {
					if (!controller.signal.aborted) setPreview(value)
				})
				.catch((err) => {
					if (!controller.signal.aborted) setError(teamError(err))
				})
				.finally(() => {
					if (!controller.signal.aborted) setLoading(false)
				})
		}
		return () => {
			active.current = false
			controller.abort()
		}
	}, [token, attempt])

	async function confirm() {
		if (locked.current || !preview || preview.alreadyMember) return
		locked.current = true
		setBusy(true)
		setError('')
		try {
			const { team } = await acceptInvite(token)
			onAccepted(team)
			if (active.current) setSuccess(team.name)
		} catch (err) {
			if (active.current) setError(teamError(err))
		} finally {
			locked.current = false
			if (active.current) setBusy(false)
		}
	}
	return (
		<main className="flex h-full flex-col overflow-y-auto bg-zinc-800/60 text-white/90">
			<header className="flex items-center gap-2 px-4 pt-3 pb-5">
				<button
					ref={back}
					type="button"
					disabled={busy}
					onClick={onClose}
					aria-label="Voltar"
					className="grid size-8 place-items-center text-white/70 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-indigo-300"
				>
					<ArrowLeft size={16} />
				</button>
				<h1 className="text-sm font-medium">Entrar com convite</h1>
			</header>
			<section
				className={token
					? 'flex flex-1 flex-col justify-center px-8 pb-8 text-center text-xs leading-relaxed'
					: 'px-4 pb-4 text-xs leading-relaxed'}
				aria-busy={busy || loading}
			>
				{token && !loading && (preview || success) && (
					<Box className="mx-auto mb-8 size-14 stroke-[1.5] text-indigo-400" aria-hidden="true" />
				)}
				{!token ? (
					<form
						onSubmit={(event) => {
							event.preventDefault()
							const value = parseInviteLink(link)
							if (value) setPendingInvite(value)
							else setError('Cole um link de convite válido do Teamdrop.')
						}}
					>
						<label htmlFor="invite-link" className="mb-2 block text-white/80">
							Link de convite
						</label>
						<input
							ref={input}
							id="invite-link"
							value={link}
							onChange={(event) => setLink(event.target.value)}
							required
							autoComplete="off"
							spellCheck={false}
							className="w-full min-w-0 rounded-md bg-white/5 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-indigo-300"
						/>
						<button
							type="submit"
							disabled={!link.trim()}
							className="mt-4 w-full py-1.5 bg-indigo-400 px-3 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-300"
						>
							Continuar
						</button>
					</form>
				) : loading ? (
					<p role="status" className="flex items-center justify-center gap-2">
						<Loader2 size={16} className="animate-spin" />
						Verificando convite…
					</p>
				) : success || preview?.alreadyMember ? (
					<>
						<p role="status">
							{success ? 'Você faz parte do time' : 'Você já participa do time'}{' '}
							<strong className="break-words">{success || preview?.team.name}</strong>.
						</p>
						<button
							type="button"
							onClick={onClose}
							className="mt-4 min-h-8 bg-indigo-400 px-3 focus-visible:ring-2 focus-visible:ring-indigo-300"
						>
							Voltar aos times
						</button>
					</>
				) : preview ? (
					<>
						<p className="break-words">
							Você foi convidado para o time{' '}
							<strong>{preview.team.name}</strong>.
						</p>
						<div className="mt-5 flex justify-center gap-2">
							<button
								type="button"
								disabled={busy}
								onClick={onClose}
								className="min-h-8 px-3 text-white/75 focus-visible:ring-2 focus-visible:ring-indigo-300"
							>
								Cancelar
							</button>
							<button
								type="button"
								disabled={busy}
								onClick={() => void confirm()}
								className="min-h-8 bg-indigo-400 px-3 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-300"
							>
								{busy ? 'Confirmando…' : 'Entrar no time'}
							</button>
						</div>
					</>
				) : null}
				{error && (
					<div role="alert" className="mt-3 text-red-300">
						<p>{error}</p>
						{!loading && !busy && token && (
							<button
								type="button"
								onClick={() => {
									setPreview(null)
									setAttempt((value) => value + 1)
								}}
								className="mt-2 underline"
							>
								Verificar novamente
							</button>
						)}
					</div>
				)}
			</section>
		</main>
	)
}
