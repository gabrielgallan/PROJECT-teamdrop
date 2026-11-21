import { ArrowLeft, Check, Copy, Crown, Link, RefreshCw, Save, Unlink, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../components/avatar'
import { ConfirmationDialog } from '../components/confirmation-dialog'
import { InlineConfirmation } from '../components/inline-confirmation'
import { MenuItem } from '../components/menu-item'
import { Separator } from '../components/separator'
import { copyText } from '../services/desktop'
import type { TeamSettings } from '../types/team'
import type { TeamActions } from '../hooks/use-team-settings'

interface TeamSettingsScreenProps {
	team: TeamSettings
	currentUserId: string
	onBack: () => void
	actions: TeamActions
}

type Confirmation = { kind: 'replace' | 'revoke' } | { kind: 'remove'; memberId: string }

export function TeamSettingsScreen({
	team,
	currentUserId,
	onBack,
	actions,
}: TeamSettingsScreenProps) {
	const {
		busy,
		error,
		createInvite: onCreateInvite,
		revokeInvite: onRevokeInvite,
		renameTeam: onRenameTeam,
		removeMember: onRemoveMember,
	} = actions
	const [inviteUrl, setInviteUrl] = useState<string | null>(null)
	useEffect(() => {
		void actions.loadMembers(team.id)
	}, [team.id])
	const backButton = useRef<HTMLButtonElement>(null)
	const inviteButton = useRef<HTMLButtonElement>(null)
	const revokeButton = useRef<HTMLButtonElement>(null)
	const [draftName, setDraftName] = useState(team.name)
	const removeButtons = useRef(new Map<string, HTMLButtonElement>())
	const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
	const [copied, setCopied] = useState(false)
	const [copyError, setCopyError] = useState('')
	const [notice, setNotice] = useState('')
	const pendingMember =
		confirmation?.kind === 'remove'
			? team.members.find((member) => member.id === confirmation.memberId)
			: undefined

	useEffect(() => {
		backButton.current?.focus()
	}, [])
	useEffect(() => {
		if (!copied) return
		const timer = setTimeout(() => setCopied(false), 2500)
		return () => clearTimeout(timer)
	}, [copied])

	function cancelConfirmation() {
		if (busy) return
		const target =
			confirmation?.kind === 'remove'
				? removeButtons.current.get(confirmation.memberId)
				: confirmation?.kind === 'revoke'
					? revokeButton.current
					: inviteButton.current
		setConfirmation(null)
		requestAnimationFrame(() => target?.focus())
	}

	useEffect(() => {
		if (pendingMember || busy) return
		function handleEscape(event: KeyboardEvent) {
			if (event.key !== 'Escape') return
			event.preventDefault()
			if (confirmation) cancelConfirmation()
			else onBack()
		}
		window.addEventListener('keydown', handleEscape)
		return () => window.removeEventListener('keydown', handleEscape)
	})

	async function createInvite() {
		const url = await onCreateInvite(team.id)
		if (!url) return
		setInviteUrl(url)
		setConfirmation(null)
		setCopied(false)
		setCopyError('')
		setNotice(inviteUrl ? 'Novo link criado.' : 'Convite criado.')
		requestAnimationFrame(() => inviteButton.current?.focus())
	}

	async function copyInvite() {
		if (!inviteUrl) return
		setCopyError('')
		try {
			await copyText(inviteUrl)
			setCopied(true)
			setNotice('Link copiado.')
		} catch {
			setCopyError('Não foi possível copiar. Selecione o link e copie manualmente.')
		}
	}

	return (
		<main className="flex h-full flex-col overflow-y-auto bg-zinc-800/60 text-white/90">
			<header className="shrink-0 px-4 pb-4 pt-3">
				<div className="mb-5 flex min-w-0 items-center gap-2">
					<button
						ref={backButton}
						type="button"
						onClick={onBack}
						disabled={busy}
						aria-label="Voltar às configurações"
						className="grid size-8 shrink-0 place-items-center text-white/70 hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-300"
					>
						<ArrowLeft size={16} aria-hidden="true" />
					</button>
					<h1 className="min-w-0 truncate text-sm font-medium" title={team.name}>
						{team.name}
					</h1>
				</div>
				<form
					className="mb-5"
					onSubmit={async (event) => {
						event.preventDefault()
						const name = draftName.trim()
						if (!name || name === team.name || busy) return
						if (!(await onRenameTeam(team.id, name))) return
						setDraftName(name)
						setNotice('Nome do time atualizado.')
					}}
				>
					<label htmlFor="team-name" className="mb-2 block text-xs font-medium text-white/75">
						Nome do time
					</label>
					<div className="flex min-w-0 items-center gap-1 rounded-md bg-white/5 p-1">
						<input
							id="team-name"
							required
							value={draftName}
							disabled={busy}
							onChange={(event) => setDraftName(event.target.value)}
							className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs text-white/85 focus-visible:ring-2 focus-visible:ring-indigo-300"
						/>
						<button
							type="submit"
							disabled={busy || !draftName.trim() || draftName.trim() === team.name}
							aria-label="Salvar nome do time"
							title="Salvar nome do time"
							className="grid size-8 shrink-0 place-items-center text-white/75 enabled:hover:bg-indigo-400 enabled:hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-300"
						>
							<Save size={16} aria-hidden="true" />
						</button>
					</div>
				</form>
				<h2 className="mb-3 text-xs font-medium text-white/75">Convite do time</h2>
				{inviteUrl && (
					<>
						<div className="flex min-w-0 items-center gap-1 rounded-md bg-white/5 p-1">
							<input
								readOnly
								aria-label="Link de convite"
								value={inviteUrl}
								onFocus={(event) => event.currentTarget.select()}
								className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs text-white/85 focus-visible:ring-2 focus-visible:ring-indigo-300"
							/>
							<button
								type="button"
								onClick={() => void copyInvite()}
								aria-label={copied ? 'Link copiado' : 'Copiar convite'}
								className="grid size-8 shrink-0 place-items-center text-white/75 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-300"
							>
								{copied ? <Check size={15} /> : <Copy size={15} />}
							</button>
						</div>
						<p className="mt-2 text-xs leading-relaxed text-white/75">
							Copie este link agora. Ao sair desta tela, será necessário gerar outro para obter um
							link novamente.
						</p>
						{copyError && (
							<p role="alert" className="mt-2 text-xs text-red-300">
								{copyError}
							</p>
						)}
					</>
				)}
				<MenuItem
					ref={inviteButton}
					disabled={busy}
					onClick={() => setConfirmation({ kind: 'replace' })}
					className="mt-2 text-xs focus-visible:ring-2 focus-visible:ring-indigo-300"
				>
					{inviteUrl ? <RefreshCw size={16} /> : <Link size={16} />}
					{inviteUrl ? 'Gerar novo link' : 'Gerar convite'}
				</MenuItem>
				<MenuItem
					ref={revokeButton}
					disabled={busy}
					variant="danger"
					onClick={() => setConfirmation({ kind: 'revoke' })}
					className="text-xs enabled:hover:bg-rose-400 focus-visible:ring-2 focus-visible:ring-red-300"
				>
					<Unlink size={16} />
					Revogar convites
				</MenuItem>
				{confirmation?.kind === 'replace' && (
					<div className="mt-2">
						<InlineConfirmation
							message="Gerar um convite invalida todos os links anteriores deste time. Continuar?"
							confirmLabel="Gerar link"
							onConfirm={() => void createInvite()}
							onCancel={cancelConfirmation}
							busy={busy}
							error={error}
						/>
					</div>
				)}
				{confirmation?.kind === 'revoke' && (
					<div className="mt-2">
						<InlineConfirmation
							message="Os links anteriores deixarão de funcionar. Revogar convites?"
							confirmLabel="Revogar"
							onCancel={cancelConfirmation}
							busy={busy}
							error={error}
							onConfirm={async () => {
								if (!(await onRevokeInvite(team.id))) return
								setInviteUrl(null)
								setConfirmation(null)
								setCopied(false)
								setCopyError('')
								setNotice('Convites revogados.')
								requestAnimationFrame(() => inviteButton.current?.focus())
							}}
						/>
					</div>
				)}
				{error && !confirmation && (
					<p role="alert" className="mt-2 text-xs text-red-300">
						{error}{' '}
						<button
							type="button"
							disabled={busy}
							onClick={() => void actions.loadMembers(team.id)}
							className="underline"
						>
							Atualizar membros
						</button>
					</p>
				)}
			</header>
			<Separator />
			<h2
				id="team-members-title"
				className="shrink-0 px-4 pb-2 pt-4 text-xs font-medium text-white/75"
			>
				Membros
			</h2>
			<section
				aria-labelledby="team-members-title"
				className="shrink-0 px-2 pb-3"
			>
				{busy && (
					<p role="status" className="px-2 text-xs text-white/70">
						Aguarde…
					</p>
				)}
				<ul>
					{team.members.map((member) => (
						<li key={member.id}>
							<div className="flex min-w-0 items-center gap-3 px-2 py-3">
								<Avatar member={member} className={`size-9 ${member.color}`} />
								<span className="min-w-0 flex-1 truncate text-[13px]" title={member.name}>
									{member.id === currentUserId ? 'Você' : member.name}
								</span>
								{member.role === 'owner' ? (
									<span
										className="grid size-8 shrink-0 place-items-center text-indigo-400"
										title="Proprietário"
									>
										<Crown size={15} aria-hidden="true" />
										<span className="sr-only">Proprietário</span>
									</span>
								) : (
									<button
										ref={(element) => {
											if (element) removeButtons.current.set(member.id, element)
											else removeButtons.current.delete(member.id)
										}}
										type="button"
										disabled={busy}
										onClick={() => setConfirmation({ kind: 'remove', memberId: member.id })}
										aria-label={`Remover ${member.name}`}
										title={`Remover ${member.name}`}
										className="grid size-8 shrink-0 place-items-center text-white/60 hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-300"
									>
										<X size={15} aria-hidden="true" />
									</button>
								)}
							</div>
						</li>
					))}
				</ul>
			</section>
			{pendingMember && (
				<ConfirmationDialog
					title="Remover membro"
					message={`Remover ${pendingMember.name} do time ${team.name}?`}
					confirmLabel="Remover membro"
					onCancel={cancelConfirmation}
					busy={busy}
					error={error}
					onConfirm={async () => {
						if (!(await onRemoveMember(team.id, pendingMember.id))) return
						setConfirmation(null)
						setNotice(`${pendingMember.name} não faz mais parte do time.`)
						requestAnimationFrame(() => backButton.current?.focus())
					}}
				/>
			)}
			<p role="status" className="sr-only">
				{notice}
			</p>
		</main>
	)
}
