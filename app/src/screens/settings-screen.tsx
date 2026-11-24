import { Box, Crown, Link, Loader2, LogOut, Plus, Settings, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../components/avatar'
import { ConfirmationDialog } from '../components/confirmation-dialog'
import { CreateTeamDialog } from '../components/create-team-dialog'
import { MenuItem } from '../components/menu-item'
import { Separator } from '../components/separator'
import { ScreenHeader } from '../components/screen-header'
import type { TeamActions } from '../hooks/use-team-settings'
import { setPendingInvite } from '../services/invites'
import type { SessionUser } from '../types/auth'
import { TeamSettingsScreen } from './team-settings-screen'

interface SettingsScreenProps {
	user: SessionUser
	onBack: () => void
	onLogout: () => void
	authBusy: boolean
	authError: string
	actions: TeamActions
}

export function SettingsScreen({
	user,
	onBack,
	onLogout,
	authBusy,
	authError,
	actions,
}: SettingsScreenProps) {
	const { teams, busy, loading, error, createTeam: onCreateTeam, leaveTeam: onLeaveTeam } = actions
	const backButton = useRef<HTMLButtonElement>(null)
	const teamButtons = useRef(new Map<string, HTMLButtonElement>())
	const createButton = useRef<HTMLButtonElement>(null)
	const [createTeamOpen, setCreateTeamOpen] = useState(false)
	const [managedTeamId, setManagedTeamId] = useState<string | null>(null)
	const [leavingTeamId, setLeavingTeamId] = useState<string | null>(null)
	const [notice, setNotice] = useState('')
	const managedTeam = teams.find((team) => team.id === managedTeamId && team.role === 'owner')
	const leavingTeam = teams.find((team) => team.id === leavingTeamId && team.role !== 'owner')

	function cancelLeave() {
		if (busy) return
		const target = leavingTeamId ? teamButtons.current.get(leavingTeamId) : null
		setLeavingTeamId(null)
		requestAnimationFrame(() => target?.focus())
	}
	const name = user.name?.trim() || user.email
	const initials = name
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0])
		.join('')
		.toUpperCase()

	useEffect(() => {
		backButton.current?.focus()
	}, [])

	useEffect(() => {
		if (managedTeam || createTeamOpen || leavingTeam || busy) return
		function handleEscape(event: KeyboardEvent) {
			if (event.key !== 'Escape') return
			event.preventDefault()
			if (leavingTeamId) cancelLeave()
			else onBack()
		}
		window.addEventListener('keydown', handleEscape)
		return () => window.removeEventListener('keydown', handleEscape)
	})

	if (managedTeam) {
		return (
			<TeamSettingsScreen
				team={managedTeam}
				currentUserId={user.id}
				onBack={() => {
					setManagedTeamId(null)
					requestAnimationFrame(() => teamButtons.current.get(managedTeam.id)?.focus())
				}}
				actions={actions}
			/>
		)
	}

	return (
		<main className="flex h-full flex-col overflow-hidden bg-zinc-800/60 text-white/90">
			<header>
				<ScreenHeader title="Configurações" backLabel="Voltar aos arquivos" onBack={onBack} backRef={backButton} />
				<div className="mx-4">
					<div className="flex min-w-0 items-center gap-3">
						<Avatar
							member={{
								id: user.id,
								name,
								initials,
								avatarUrl: user.avatarUrl ?? undefined,
								color: '',
							}}
							className="size-11 bg-indigo-400/15 text-indigo-100"
							hasBorder
						/>
						<div className="min-w-0 flex-1 space-y-1">
							<p className="truncate text-ui font-medium" title={name}>
								{name}
							</p>
							<p className="truncate text-xs text-white/70" title={user.email}>
								{user.email}
							</p>
						</div>
					</div>
				</div>

				<div className="menu-group my-4">
					<MenuItem disabled={busy} onClick={() => setPendingInvite('')}>
						<Link className="size-4" aria-hidden="true" />
						Entrar com convite
					</MenuItem>
					<MenuItem
						ref={createButton}
						disabled={authBusy || busy}
						onClick={() => {
							setLeavingTeamId(null)
							setCreateTeamOpen(true)
						}}
					>
						<Plus className="size-4" aria-hidden="true" />
						Criar novo time
					</MenuItem>
					<MenuItem
						type="button"
						onClick={onLogout}
						disabled={authBusy || busy}
						aria-busy={authBusy}
						variant="danger"
					>
						{authBusy ? (
							<Loader2 className="animate-spin size-4 mx-auto" />
						) : (
							<>
								<LogOut className="size-4" aria-hidden="true" />
								Logout
							</>
						)}
					</MenuItem>
				</div>

				{error && (
					<p role="alert" className="mx-4 mb-4 text-xs text-red-300">
						{error}{' '}
						<button
							type="button"
							disabled={busy}
							onClick={() => void actions.refresh()}
							className="underline"
						>
							Atualizar
						</button>
					</p>
				)}
				{authError && (
					<p role="alert" className="mx-4 mb-4 text-xs leading-relaxed text-red-300">
						{authError}
					</p>
				)}
			</header>

			<Separator />

			<h2
				id="settings-teams-title"
				className="section-title"
			>
				Seus times
			</h2>
			<section
				aria-labelledby="settings-teams-title"
				className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
			>
				{loading ? (
					<p role="status" className="px-2 py-4 text-xs text-white/70">
						Carregando times…
					</p>
				) : teams.length === 0 ? (
					<p className="px-2 py-4 text-xs leading-relaxed text-white/70">
						Você ainda não participa de nenhum time.
					</p>
				) : (
					<ul className="item-list">
						{teams.map((team) => (
							<li key={team.id}>
								<div className="list-row">
									<span className="item-icon text-white/70">
										<Box size={18} aria-hidden="true" />
									</span>
									<span className="min-w-0 flex-1 truncate text-ui" title={team.name}>
										{team.name}
									</span>
									{team.role === 'owner' && (
										<span className="shrink-0 text-indigo-400" title="Você é proprietário">
											<Crown size={16} aria-hidden="true" />
											<span className="sr-only">Você é proprietário</span>
										</span>
									)}
									<button
										ref={(element) => {
											if (element) teamButtons.current.set(team.id, element)
											else teamButtons.current.delete(team.id)
										}}
										type="button"
										disabled={busy}
										onClick={() => {
											if (team.role === 'owner') {
												setLeavingTeamId(null)
												setManagedTeamId(team.id)
											} else setLeavingTeamId(team.id)
										}}
										aria-label={
											team.role === 'owner' ? `Gerenciar ${team.name}` : `Sair do time ${team.name}`
										}
										title={team.role === 'owner' ? 'Gerenciar time' : 'Sair do time'}
										className="icon-button text-white/60 hover:bg-white/5 hover:text-white"
									>
										{team.role === 'owner' ? (
											<Settings size={16} aria-hidden="true" />
										) : (
											<X size={16} aria-hidden="true" />
										)}
									</button>
								</div>
							</li>
						))}
					</ul>
				)}
			</section>
			{leavingTeam && (
				<ConfirmationDialog
					title="Sair do time"
					message={`Deseja sair do time ${leavingTeam.name}?`}
					confirmLabel="Sair do time"
					onCancel={cancelLeave}
					busy={busy}
					error={error}
					onConfirm={async () => {
						if (!(await onLeaveTeam(leavingTeam.id))) return
						setLeavingTeamId(null)
						setNotice(`Você saiu do time ${leavingTeam.name}.`)
						requestAnimationFrame(() => backButton.current?.focus())
					}}
				/>
			)}
			{createTeamOpen && (
				<CreateTeamDialog
					onClose={() => {
						setCreateTeamOpen(false)
						requestAnimationFrame(() => createButton.current?.focus())
					}}
					busy={busy}
					error={error}
					onCreate={async (name) => {
						if (!(await onCreateTeam(name))) return false
						setNotice(`Time ${name} criado.`)
						return true
					}}
				/>
			)}
			<p role="status" className="sr-only">
				{notice}
			</p>
		</main>
	)
}
