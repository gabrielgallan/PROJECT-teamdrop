import { useQuery } from '@tanstack/react-query'
import { Box, Crown, Link, Loader2, LogOut, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { userTeamsQuery } from '../../api/teams/queries'
import { useAuth } from '../../hooks/use-auth'
import { useScreenBack } from '../../hooks/use-navigation'
import { errorMessage } from '../../lib/api-error'
import { AuthNotice } from '../components/auth-notice'
import { Avatar } from '../components/avatar'
import { CreateTeamDialog } from '../components/create-team-dialog'
import { MenuItem } from '../components/menu-item'
import { ScreenHeader } from '../components/screen-header'
import { Separator } from '../components/separator'
import { ListSkeleton } from '../components/skeleton'
import { memberView } from '../utils/presentation'

export function SettingsScreen() {
	const auth = useAuth()
	const listing = useQuery({ ...userTeamsQuery(auth.user.id), enabled: auth.canQuery })
	const navigate = useNavigate()
	const [createOpen, setCreateOpen] = useState(false)
	const createButton = useRef<HTMLButtonElement>(null)
	const back = useScreenBack(
		'/',
		'settings-button',
		createOpen,
	)
	const teams = listing.data?.teams ?? []
	return (
		<main className="flex h-full flex-col overflow-hidden bg-zinc-800/60 text-white/90">
			<header className="shrink-0 pb-4">
				<ScreenHeader title="Configurações" backLabel="Voltar aos arquivos" {...back} />
				<div className="mx-4 flex items-center gap-3 pb-4">
					<Avatar member={memberView(auth.user)} className="size-10" />
					<div className="min-w-0">
						<p className="truncate text-sm">{auth.user.name || auth.user.email}</p>
						<p className="truncate text-xs text-white/60">{auth.user.email}</p>
					</div>
				</div>
				<div className="menu-group">
					<MenuItem
						ref={createButton}
						disabled={!auth.canQuery}
						onClick={() => setCreateOpen(true)}
					>
						<Plus className="size-4" />
						Criar novo time
					</MenuItem>
					<MenuItem
						id="accept-invite-button"
						disabled={!auth.canQuery}
						onClick={() => void navigate('/invites/accept')}
					>
						<Link className="size-4" />
						Entrar com convite
					</MenuItem>
					<MenuItem disabled={auth.busy !== null} onClick={() => void auth.logout()}>
						{auth.busy === 'logout' ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<>
								<LogOut className="size-4" />
								Logout
							</>
						)}
					</MenuItem>
				</div>
				<AuthNotice />
				{listing.error && (
					<div role="alert" className="mx-4 mt-4 text-xs text-red-300">
						{errorMessage(listing.error)}{' '}
						<button
							type="button"
							disabled={!auth.canQuery || listing.isFetching}
							onClick={() => void listing.refetch()}
							className="underline"
						>
							Atualizar
						</button>
					</div>
				)}
			</header>
			<Separator />
			<h2 id="settings-teams-title" tabIndex={-1} className="section-title">
				Seus times
			</h2>
			<section
				aria-labelledby="settings-teams-title"
				aria-busy={listing.isFetching}
				className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
			>
				{listing.isPending ? (
					listing.isFetching && <ListSkeleton variant="team" />
				) : !listing.error && teams.length === 0 ? (
					<p className="px-2 py-4 text-xs leading-relaxed text-white/70">
						Você ainda não participa de nenhum time.
					</p>
				) : (
					<ul className="item-list">
						{teams.map((team) => (
							<li key={team.id}>
								<button
									id={`manage-team-${team.id}`}
									type="button"
									disabled={!auth.canQuery}
									onClick={() => void navigate(`/settings/teams/${encodeURIComponent(team.id)}`)}
									aria-label={team.role === 'owner' ? `Gerenciar ${team.name}` : `Abrir time ${team.name}`}
									className="list-row group w-full text-left transition-colors hover:bg-white/4 focus-visible:ring-2 focus-visible:ring-indigo-300"
								>
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
								</button>
							</li>
						))}
					</ul>
				)}
			</section>
			{createOpen && (
				<CreateTeamDialog
					onClose={() => {
						setCreateOpen(false)
						requestAnimationFrame(() => createButton.current?.focus())
					}}
				/>
			)}
		</main>
	)
}
