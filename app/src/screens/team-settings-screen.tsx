import { ArrowLeft, Check, Copy, Crown, Link, RefreshCw, Save, Unlink, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../components/avatar'
import { ConfirmationDialog } from '../components/confirmation-dialog'
import { InlineConfirmation } from '../components/inline-confirmation'
import { MenuItem } from '../components/menu-item'
import { Separator } from '../components/separator'
import { copyText } from '../services/desktop'
import type { TeamSettings } from '../types/team'

interface TeamSettingsScreenProps {
	team: TeamSettings
	currentUserId: string
	onBack: () => void
	onCreateInvite: (teamId: string) => void
	onRevokeInvite: (teamId: string) => void
	onRenameTeam: (teamId: string, name: string) => void
	onRemoveMember: (teamId: string, memberId: string) => void
}

type Confirmation = { kind: 'replace' | 'revoke' } | { kind: 'remove'; memberId: string }

export function TeamSettingsScreen({
	team,
	currentUserId,
	onBack,
	onCreateInvite,
	onRevokeInvite,
	onRenameTeam,
	onRemoveMember,
}: TeamSettingsScreenProps) {
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
		if (pendingMember) return
		function handleEscape(event: KeyboardEvent) {
			if (event.key !== 'Escape') return
			event.preventDefault()
			if (confirmation) cancelConfirmation()
			else onBack()
		}
		window.addEventListener('keydown', handleEscape)
		return () => window.removeEventListener('keydown', handleEscape)
	})

	function createInvite() {
		onCreateInvite(team.id)
		setConfirmation(null)
		setCopied(false)
		setCopyError('')
		setNotice(team.inviteUrl ? 'Novo link criado.' : 'Convite criado.')
		requestAnimationFrame(() => inviteButton.current?.focus())
	}

	async function copyInvite() {
		if (!team.inviteUrl) return
		setCopyError('')
		try {
			await copyText(team.inviteUrl)
			setCopied(true)
			setNotice('Link copiado.')
		} catch {
			setCopyError('Não foi possível copiar. Selecione o link e copie manualmente.')
		}
	}

	return (
		<main className="flex h-full flex-col overflow-hidden bg-zinc-800/60 text-white/90">
			<header className="shrink-0 px-4 pb-4 pt-3">
				<div className="mb-5 flex min-w-0 items-center gap-2">
					<button
						ref={backButton}
						type="button"
						onClick={onBack}
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
					onSubmit={(event) => {
						event.preventDefault()
						const name = draftName.trim()
						if (!name || name === team.name) return
						onRenameTeam(team.id, name)
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
							onChange={(event) => setDraftName(event.target.value)}
							className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs text-white/85 focus-visible:ring-2 focus-visible:ring-indigo-300"
						/>
						<button
							type="submit"
							disabled={!draftName.trim() || draftName.trim() === team.name}
							aria-label="Salvar nome do time"
							title="Salvar nome do time"
							className="grid size-8 shrink-0 place-items-center text-white/75 enabled:hover:bg-indigo-400 enabled:hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-300"
						>
							<Save size={16} aria-hidden="true" />
						</button>
					</div>
				</form>
				<h2 className="mb-3 text-xs font-medium text-white/75">Convite do time</h2>
				{team.inviteUrl ? (
					<>
						<div className="flex min-w-0 items-center gap-1 rounded-md bg-white/5 p-1">
							<input
								readOnly
								aria-label="Link de convite"
								value={team.inviteUrl}
								onFocus={(event) => event.currentTarget.select()}
								className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs text-white/85 focus-visible:ring-2 focus-visible:ring-indigo-300"
							/>
							<button
								type="button"
								onClick={() => void copyInvite()}
								aria-label={copied ? 'Link copiado' : 'Copiar convite'}
								title={copied ? 'Link copiado' : 'Copiar convite'}
								className="grid size-8 shrink-0 place-items-center text-white/75 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-300"
							>
								{copied ? (
									<Check size={15} aria-hidden="true" />
								) : (
									<Copy size={15} aria-hidden="true" />
								)}
							</button>
						</div>
						{copyError && (
							<p role="alert" className="mt-2 text-xs leading-relaxed text-red-300">
								{copyError}
							</p>
						)}
						<div>
							<MenuItem
								ref={inviteButton}
								onClick={() => setConfirmation({ kind: 'replace' })}
								className="mt-2 text-xs focus-visible:ring-2 focus-visible:ring-indigo-300"
							>
								<RefreshCw size={16} aria-hidden="true" />
								Gerar novo link
							</MenuItem>
							<MenuItem
								ref={revokeButton}
								variant="danger"
								onClick={() => setConfirmation({ kind: 'revoke' })}
								className="text-xs enabled:hover:bg-rose-400 focus-visible:ring-2 focus-visible:ring-red-300"
							>
								<Unlink size={16} aria-hidden="true" />
								Revogar link atual
							</MenuItem>
						</div>
					</>
				) : (
					<MenuItem
						ref={inviteButton}
						onClick={createInvite}
						className="text-xs focus-visible:ring-2 focus-visible:ring-indigo-300"
					>
						<Link size={16} aria-hidden="true" />
						Criar convite
					</MenuItem>
				)}
				{confirmation?.kind === 'replace' && (
					<div className="mt-2">
						<InlineConfirmation
							message="O link atual deixará de funcionar. Gerar outro?"
							confirmLabel="Gerar novo link"
							onConfirm={createInvite}
							onCancel={cancelConfirmation}
						/>
					</div>
				)}
				{confirmation?.kind === 'revoke' && (
					<div className="mt-2">
						<InlineConfirmation
							message="O link atual deixará de funcionar. Revogar convite?"
							confirmLabel="Revogar link"
							onCancel={cancelConfirmation}
							onConfirm={() => {
								onRevokeInvite(team.id)
								setConfirmation(null)
								setCopied(false)
								setCopyError('')
								setNotice('Link de convite revogado.')
								requestAnimationFrame(() => inviteButton.current?.focus())
							}}
						/>
					</div>
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
				className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
			>
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
					onConfirm={() => {
						onRemoveMember(team.id, pendingMember.id)
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
