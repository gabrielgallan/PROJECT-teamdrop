import { useQuery } from '@tanstack/react-query'
import { Box, Link, Loader2, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { userTeamsQuery } from '../../api/teams/queries'
import { useAuth } from '../../hooks/use-auth'
import { useScreenBack } from '../../hooks/use-navigation'
import { errorMessage } from '../../lib/api-error'
import { AuthNotice } from '../components/auth-notice'
import { Avatar } from '../components/avatar'
import { CreateTeamDialog } from '../components/create-team-dialog'
import { Dialog } from '../components/dialog'
import { LogoutIcon, type LogoutIconHandle } from '../components/icons/logout'
import { InviteLinkDialog } from '../components/invite-link-dialog'
import { MenuItem } from '../components/menu-item'
import { ScreenHeader } from '../components/screen-header'
import { Separator } from '../components/separator'
import { ListSkeleton } from '../components/skeleton'
import { UserPreferences } from '../components/user-preferences'
import { memberView } from '../utils/presentation'

export function SettingsScreen() {
	const auth = useAuth()
	const logoutIcon = useRef<LogoutIconHandle>(null)
	const listing = useQuery({
		...userTeamsQuery(auth.user.id),
		enabled: auth.canQuery,
	})
	const navigate = useNavigate()
	const [teamDialog, setTeamDialog] = useState<
		'options' | 'create' | 'invite' | null
	>(null)
	const teamButton = useRef<HTMLButtonElement>(null)
	const back = useScreenBack('/', 'settings-button', teamDialog !== null)
	function closeTeamDialog() {
		setTeamDialog(null)
		requestAnimationFrame(() => teamButton.current?.focus())
	}
	const teams = listing.data?.teams ?? []
	return (
		<main className="flex h-full flex-col overflow-hidden bg-zinc-800/60 text-white/90">
			<header className="shrink-0 pb-4">
				<ScreenHeader
					title="Configurações"
					backLabel="Voltar aos arquivos"
					{...back}
				/>
				<div className="mx-4 flex items-center gap-3 pb-4">
					<Avatar member={memberView(auth.user)} className="size-10" />
					<div className="min-w-0">
						<p className="truncate text-sm">
							{auth.user.name || auth.user.email}
						</p>
						<p className="truncate text-xs text-white/60">{auth.user.email}</p>
					</div>
				</div>
				<div className="menu-group">
					<MenuItem
						variant="danger"
						disabled={auth.busy !== null}
						onClick={() => void auth.logout()}
						onMouseEnter={() => logoutIcon.current?.startAnimation()}
						onMouseLeave={() => logoutIcon.current?.stopAnimation()}
					>
						{auth.busy === 'logout' ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<>
								<LogoutIcon
									ref={logoutIcon}
									aria-hidden="true"
									size={16}
									className="shrink-0"
								/>
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
			<div className="min-h-0 flex-1 overflow-y-auto pb-4">
				<UserPreferences />
				<Separator />
				<div className="mx-4 mb-2 mt-4 flex items-center justify-between gap-2">
					<h2
						id="settings-teams-title"
						tabIndex={-1}
						className="text-xs font-medium text-white/75"
					>
						Seus times
					</h2>
					<button
						ref={teamButton}
						id="add-team-button"
						type="button"
						className="icon-button text-white/70 hover:bg-white/5 hover:text-white"
						aria-label="Adicionar time"
						aria-haspopup="dialog"
						disabled={!auth.canQuery}
						onClick={() => setTeamDialog('options')}
					>
						<Plus aria-hidden="true" />
					</button>
				</div>
				<section
					aria-labelledby="settings-teams-title"
					aria-busy={listing.isFetching}
					className="px-2 pb-4"
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
										onClick={() =>
											void navigate(
												`/settings/teams/${encodeURIComponent(team.id)}`,
											)
										}
										aria-label={
											team.role === 'owner'
												? `Gerenciar ${team.name}`
												: `Abrir time ${team.name}`
										}
										className="list-row group w-full text-left transition-colors hover:bg-white/4 focus-visible:ring-2 focus-visible:ring-indigo-300"
									>
										<span className="item-icon text-white/70">
											<Box size={18} aria-hidden="true" />
										</span>
										<span
											className="min-w-0 flex-1 truncate text-ui"
											title={team.name}
										>
											{team.name}
										</span>
										{team.role === 'owner' && (
											<span
												className="shrink-0 text-indigo-300 text-xs font-bold"
												title="Você é proprietário"
											>
												{/*<Crown size={16} aria-hidden="true" />
												<span className="sr-only">Você é proprietário</span>*/}
												Seu time
											</span>
										)}
									</button>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
			{teamDialog === 'options' && (
				<Dialog open title="Adicionar time" onClose={closeTeamDialog}>
					<MenuItem
						disabled={!auth.canQuery}
						onClick={() => setTeamDialog('create')}
					>
						<Plus aria-hidden="true" />
						Criar novo time
					</MenuItem>
					<MenuItem
						disabled={!auth.canQuery}
						onClick={() => setTeamDialog('invite')}
					>
						<Link aria-hidden="true" />
						Entrar com convite
					</MenuItem>
				</Dialog>
			)}
			{teamDialog === 'create' && (
				<CreateTeamDialog onClose={closeTeamDialog} />
			)}
			{teamDialog === 'invite' && (
				<InviteLinkDialog onClose={closeTeamDialog} />
			)}
		</main>
	)
}
