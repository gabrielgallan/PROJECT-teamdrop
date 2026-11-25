import { useMutation } from '@tanstack/react-query'
import { Check, Copy, Link, RefreshCw, Unlink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createTeamInvite } from '../../api/invites/create-team-invite'
import { revokeTeamInvites } from '../../api/invites/revoke-team-invites'
import { useAccountMutation } from '../../api/use-account-mutation'
import { copyText } from '../../desktop/app.commands'
import { useAuth } from '../../hooks/use-auth'
import { errorMessage } from '../../lib/api-error'
import { InlineConfirmation } from './inline-confirmation'
import { MenuItem } from './menu-item'
import { OperationFeedback } from './operation-feedback'

export function TeamInvites({ teamId }: { teamId: string }) {
	const { canQuery } = useAuth()
	const create = useAccountMutation(createTeamInvite)
	const revoke = useAccountMutation(revokeTeamInvites)
	const copy = useMutation({ mutationFn: copyText })
	const [confirmation, setConfirmation] = useState<'replace' | 'revoke' | null>(
		null,
	)
	const inviteButton = useRef<HTMLButtonElement>(null)
	const revokeButton = useRef<HTMLButtonElement>(null)
	const busy = create.isPending || revoke.isPending
	const url = create.data?.url
	const cancel = () => {
		if (busy) return
		const trigger = confirmation === 'revoke' ? revokeButton : inviteButton
		setConfirmation(null)
		requestAnimationFrame(() => trigger.current?.focus())
	}
	useEffect(() => {
		if (!confirmation) return
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault()
				cancel()
			}
		}
		window.addEventListener('keydown', handleEscape)
		return () => window.removeEventListener('keydown', handleEscape)
	})
	return (
		<>
			<h2 className="mx-4 mb-2 text-xs font-medium text-white/75">
				Convite do time
			</h2>
			{url && (
				<div className="mx-4 mb-2 space-y-2">
					<div className="flex min-w-0 items-center gap-1 rounded-md bg-white/5 p-1">
						<input
							readOnly
							aria-label="Link de convite"
							value={url}
							onFocus={(event) => event.currentTarget.select()}
							className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs text-white/85 focus-visible:ring-2 focus-visible:ring-indigo-300"
						/>
						<button
							type="button"
							onClick={() => copy.mutate(url)}
							aria-label={copy.isSuccess ? 'Link copiado' : 'Copiar convite'}
							className="grid size-8 shrink-0 place-items-center text-white/75 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-300"
						>
							{copy.isSuccess ? <Check size={16} /> : <Copy size={16} />}
						</button>
					</div>
					<p className="mt-2 text-xs leading-relaxed text-white/75">
						Copie este link agora. Ao sair desta tela, será necessário gerar
						outro para obter um link novamente.
					</p>
					{copy.error && (
						<p role="alert" className="mt-2 text-xs text-red-300">
							Não foi possível copiar. Selecione o link e copie manualmente.
						</p>
					)}
				</div>
			)}
			<div className="menu-group">
				<MenuItem
					ref={inviteButton}
					disabled={busy || !canQuery}
					onClick={() => {
						revoke.reset()
						copy.reset()
						setConfirmation('replace')
					}}
				>
					{url ? <RefreshCw size={16} /> : <Link size={16} />}
					{url ? 'Gerar novo link' : 'Gerar convite'}
				</MenuItem>
				<MenuItem
					ref={revokeButton}
					disabled={busy || !canQuery}
					variant="danger"
					onClick={() => {
						revoke.reset()
						setConfirmation('revoke')
					}}
				>
					<Unlink size={16} />
					Revogar convites
				</MenuItem>
			</div>
			{confirmation && (
				<div className="mx-4 mt-2">
					<InlineConfirmation
						message={
							confirmation === 'replace'
								? 'Gerar um convite invalida todos os links anteriores deste time. Continuar?'
								: 'Os links anteriores deixarão de funcionar. Revogar convites?'
						}
						confirmLabel={confirmation === 'replace' ? 'Gerar link' : 'Revogar'}
						onCancel={cancel}
						busy={busy || !canQuery}
						error={errorMessage(
							confirmation === 'replace' ? create.error : revoke.error,
						)}
						onConfirm={() => {
							if (busy || !canQuery) return
							if (confirmation === 'replace')
								create.mutate(
									{ teamId },
									{
										onSuccess: () => {
											setConfirmation(null)
											copy.reset()
											requestAnimationFrame(() => inviteButton.current?.focus())
										},
									},
								)
							else
								revoke.mutate(
									{ teamId },
									{
										onSuccess: () => {
											create.reset()
											copy.reset()
											setConfirmation(null)
											requestAnimationFrame(() => inviteButton.current?.focus())
										},
									},
								)
						}}
					/>
				</div>
			)}
			{revoke.isSuccess && (
				<OperationFeedback
					key={revoke.submittedAt}
					message="Convites revogados."
				/>
			)}
		</>
	)
}
