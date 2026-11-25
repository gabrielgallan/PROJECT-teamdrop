import { useQuery } from '@tanstack/react-query'
import { Box, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getInviteDetails } from '../../api/invites/get-invite-details'
import { useAcceptTeamInvite } from '../../api/invites/mutations'
import { queryKeys } from '../../api/query-keys'
import { getPendingInvite, parseInviteLink, setPendingInvite } from '../../desktop/invite-links'
import { useAuth } from '../../hooks/use-auth'
import { useScreenBack } from '../../hooks/use-navigation'
import { errorMessage } from '../../lib/api-error'
import { AuthNotice } from '../components/auth-notice'
import { ScreenHeader } from '../components/screen-header'

export function AcceptInviteScreen() {
	const { token = '' } = useParams()
	return <AcceptInvite key={token} token={token} />
}

function AcceptInvite({ token }: { token: string }) {
	const { user, canQuery } = useAuth()
	const navigate = useNavigate()
	const [link, setLink] = useState('')
	const [inputError, setInputError] = useState('')
	const input = useRef<HTMLInputElement>(null)
	const query = useQuery({
		queryKey: queryKeys.invite(user.id, token),
		queryFn: ({ signal }) => getInviteDetails({ token }, signal),
		enabled: Boolean(token) && canQuery,
		staleTime: 0,
		gcTime: 0,
	})
	const accept = useAcceptTeamInvite()
	const busy = accept.isPending
	const loading = Boolean(token) && query.isFetching && !query.data
	const preview = query.data
	const success = accept.data?.team.name
	const error = inputError || errorMessage(accept.error || query.error)
	const back = useScreenBack('/settings', 'accept-invite-button', busy)
	const close = () => {
		setPendingInvite(null)
		back.onBack()
	}
	// Consume the pending OS link once it is represented by the internal route.
	useEffect(() => {
		if (getPendingInvite() === token) setPendingInvite(null)
		if (!token) input.current?.focus()
	}, [token])
	return (
		<main className="flex h-full flex-col overflow-y-auto bg-zinc-800/60 text-white/90">
			<header>
				<ScreenHeader
					title="Entrar com convite"
					backLabel="Voltar"
					onBack={close}
					backRef={back.backRef}
					disabled={busy}
				/>
			</header>
			<AuthNotice />
			<section
				className={
					token
						? 'flex flex-1 flex-col justify-center px-8 pb-8 text-center text-xs leading-relaxed'
						: 'px-4 pb-4 text-xs leading-relaxed'
				}
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
							if (value) void navigate(`/invites/${encodeURIComponent(value)}/accept`)
							else setInputError('Cole um link de convite válido do Teamdrop.')
						}}
					>
						<label htmlFor="invite-link" className="mb-2 block text-white/80">
							Link de convite
						</label>
						<input
							ref={input}
							id="invite-link"
							value={link}
							onChange={(event) => {
								setLink(event.target.value)
								setInputError('')
							}}
							required
							autoComplete="off"
							spellCheck={false}
							className="w-full min-w-0 rounded-md bg-white/5 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-indigo-300"
						/>
						<button
							type="submit"
							disabled={!link.trim() || !canQuery}
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
							<strong>{success || preview?.team.name}</strong>.
						</p>
						<button
							type="button"
							onClick={close}
							className="mt-4 min-h-8 bg-indigo-400 px-3 focus-visible:ring-2 focus-visible:ring-indigo-300"
						>
							Voltar aos times
						</button>
					</>
				) : preview ? (
					<>
						<p>
							Você foi convidado para o time <strong>{preview.team.name}</strong>.
						</p>
						<div className="mt-4 flex justify-center gap-2">
							<button
								type="button"
								disabled={busy}
								onClick={close}
								className="min-h-8 px-3 text-white/75 focus-visible:ring-2 focus-visible:ring-indigo-300"
							>
								Cancelar
							</button>
							<button
								type="button"
								disabled={busy || !canQuery}
								onClick={() => {
									if (!busy && canQuery) accept.mutate({ token })
								}}
								className="min-h-8 bg-indigo-400 px-3 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-300"
							>
								{busy ? 'Confirmando…' : 'Entrar no time'}
							</button>
						</div>
					</>
				) : null}
				{error && (
					<div role="alert" className="mt-2 text-red-300">
						<p>{error}</p>
						{!loading && !busy && token && (
							<button
								type="button"
								disabled={!canQuery}
								onClick={() => {
									accept.reset()
									void query.refetch()
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
