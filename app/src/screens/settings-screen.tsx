import { ArrowLeft, Box, Crown, Loader2, LogOut, Plus, Settings, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../components/avatar'
import { ConfirmationDialog } from '../components/confirmation-dialog'
import { CreateTeamDialog } from '../components/create-team-dialog'
import { MenuItem } from '../components/menu-item'
import { Separator } from '../components/separator'
import type { SessionUser } from '../types/auth'
import type { TeamSettings } from '../types/team'
import { TeamSettingsScreen } from './team-settings-screen'

interface SettingsScreenProps {
	user: SessionUser
	onBack: () => void
	onLogout: () => void
	authBusy: boolean
	authError: string
	teams: TeamSettings[]
	onCreateTeam: (name: string) => void
	onLeaveTeam: (teamId: string) => void
	onCreateInvite: (teamId: string) => void
	onRevokeInvite: (teamId: string) => void
	onRenameTeam: (teamId: string, name: string) => void
	onRemoveMember: (teamId: string, memberId: string) => void
}

export function SettingsScreen({
	user,
	onBack,
	onLogout,
	authBusy,
	authError,
	teams,
	onCreateTeam,
	onLeaveTeam,
	onCreateInvite,
	onRevokeInvite,
	onRenameTeam,
	onRemoveMember,
}: SettingsScreenProps) {
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
		if (managedTeam || createTeamOpen || leavingTeam) return
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
				onCreateInvite={onCreateInvite}
				onRevokeInvite={onRevokeInvite}
				onRenameTeam={onRenameTeam}
				onRemoveMember={onRemoveMember}
			/>
		)
	}

	return (
		<main className="flex h-full flex-col overflow-hidden bg-zinc-800/60 text-white/90">
			<header className="shrink-0 px-4 pb-4 pt-3">
				<div className="mb-5 flex items-center gap-2">
					<button
						ref={backButton}
						type="button"
						onClick={onBack}
						aria-label="Voltar aos arquivos"
						className="grid size-8 shrink-0 place-items-center text-white/70 hover:bg-white/5 hover:text-white focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-300"
					>
						<ArrowLeft size={16} aria-hidden="true" />
					</button>
					<h1 className="text-sm font-medium">Configurações</h1>
				</div>

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
					<div className="min-w-0 flex-1">
						<p className="truncate text-[13px] font-medium" title={name}>
							{name}
						</p>
						<p className="mt-1 truncate text-xs text-white/70" title={user.email}>
							{user.email}
						</p>
					</div>
				</div>
				<MenuItem
					type="button"
					onClick={onLogout}
					disabled={authBusy}
					aria-busy={authBusy}
					className="mt-3 flex items-center"
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
				<MenuItem
					ref={createButton}
					disabled={authBusy}
					onClick={() => {
						setLeavingTeamId(null)
						setCreateTeamOpen(true)
					}}
					className="focus-visible:ring-2 focus-visible:ring-indigo-300"
				>
					<Plus size={16} aria-hidden="true" />
					Criar novo time
				</MenuItem>
				{authError && (
					<p role="alert" className="mt-2 text-xs leading-relaxed text-red-300">
						{authError}
					</p>
				)}
			</header>

			<Separator />
			<h2
				id="settings-teams-title"
				className="shrink-0 px-4 pb-2 pt-4 text-xs font-medium text-white/75"
			>
				Seus times
			</h2>
			<section
				aria-labelledby="settings-teams-title"
				className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
			>
				{teams.length === 0 ? (
					<p className="px-2 py-4 text-xs leading-relaxed text-white/70">
						Você ainda não participa de nenhum time.
					</p>
				) : (
					<ul>
						{teams.map((team) => (
							<li key={team.id}>
								<div className="flex min-w-0 items-center gap-3 px-2 py-3">
									<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/5 text-white/70">
										<Box size={17} aria-hidden="true" />
									</span>
									<span className="min-w-0 flex-1 truncate text-[13px]" title={team.name}>
										{team.name}
									</span>
									{team.role === 'owner' && (
										<span className="shrink-0 text-indigo-400" title="Você é proprietário">
											<Crown size={15} aria-hidden="true" />
											<span className="sr-only">Você é proprietário</span>
										</span>
									)}
									<button
										ref={(element) => {
											if (element) teamButtons.current.set(team.id, element)
											else teamButtons.current.delete(team.id)
										}}
										type="button"
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
										className="grid size-8 shrink-0 place-items-center text-white/60 hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-300"
									>
										{team.role === 'owner' ? (
											<Settings size={15} aria-hidden="true" />
										) : (
											<X size={15} aria-hidden="true" />
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
					onConfirm={() => {
						onLeaveTeam(leavingTeam.id)
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
					onCreate={(name) => {
						onCreateTeam(name)
						setNotice(`Time ${name} criado.`)
					}}
				/>
			)}
			<p role="status" className="sr-only">
				{notice}
			</p>
		</main>
	)
}
