import { useQuery } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useLeaveTeam } from '../../api/teams/mutations'
import { userTeamsQuery } from '../../api/teams/queries'
import { useAuth } from '../../hooks/use-auth'
import { useScreenBack } from '../../hooks/use-navigation'
import { errorMessage } from '../../lib/api-error'
import { AuthNotice } from '../components/auth-notice'
import { ConfirmationDialog } from '../components/confirmation-dialog'
import { MenuItem } from '../components/menu-item'
import { ScreenHeader } from '../components/screen-header'
import { Separator } from '../components/separator'
import { Skeleton } from '../components/skeleton'
import { TeamInvites } from '../components/team-invites'
import { TeamMembers } from '../components/team-members'
import { TeamNameForm } from '../components/team-name-form'
import { TeamRetentionForm } from '../components/team-retention-form'

export function TeamSettingsScreen() {
	const { teamId = '' } = useParams()
	return <TeamSettings key={teamId} teamId={teamId} />
}

function TeamSettings({ teamId }: { teamId: string }) {
	const { user, canQuery } = useAuth()
	const listing = useQuery({ ...userTeamsQuery(user.id), enabled: canQuery })
	const team = listing.data?.teams.find((item) => item.id === teamId)
	const navigate = useNavigate()
	const leave = useLeaveTeam()
	const [leaving, setLeaving] = useState(false)
	const leaveButton = useRef<HTMLButtonElement>(null)
	const back = useScreenBack('/settings', `manage-team-${teamId}`)
	return (
		<main className="flex h-full flex-col overflow-y-auto bg-zinc-800/60 text-white/90">
			<header className="shrink-0 pb-4">
				<ScreenHeader
					title={team?.name ?? 'Gerenciar time'}
					backLabel="Voltar às configurações"
					{...back}
				/>
				<AuthNotice />
				{listing.isPending && canQuery && (
					<div role="status" aria-busy="true" className="mx-4 space-y-4">
						<span className="sr-only">Carregando time…</span>
						<Skeleton className="h-3 w-24" />
						<Skeleton className="h-11 w-full" />
						<Skeleton className="h-3 w-28" />
						<Skeleton className="h-8 w-full" />
						<Skeleton className="h-8 w-full" />
					</div>
				)}
				{listing.error && (
					<div role="alert" className="mx-4 text-xs text-red-300">
						{errorMessage(listing.error)}{' '}
						<button
							type="button"
							disabled={!canQuery || listing.isFetching}
							onClick={() => void listing.refetch()}
							className="underline"
						>
							Tentar novamente
						</button>
					</div>
				)}
				{listing.isSuccess && !team && (
					<p role="alert" className="mx-4 text-xs text-red-300">
						O time não está mais disponível.
					</p>
				)}
				{team?.role === 'owner' && (
					<>
						<TeamNameForm team={team} />
						<TeamRetentionForm team={team} />
						<TeamInvites teamId={teamId} />
					</>
				)}
				{team?.role === 'member' && (
					<div className="menu-group">
						<MenuItem
							ref={leaveButton}
							variant="danger"
							disabled={!canQuery || leave.isPending}
							onClick={() => {
								leave.reset()
								setLeaving(true)
							}}
						>
							<LogOut aria-hidden="true" />
							Sair do time
						</MenuItem>
					</div>
				)}
			</header>
			{team && (
				<>
					<Separator />
					<TeamMembers
						teamId={teamId}
						teamName={team.name}
						canManage={team.role === 'owner'}
					/>
				</>
			)}
			{leaving && team && (
				<ConfirmationDialog
					title="Sair do time"
					message={`Deseja sair do time ${team.name}?`}
					confirmLabel="Sair do time"
					busy={leave.isPending}
					error={errorMessage(leave.error)}
					onCancel={() => {
						if (leave.isPending) return
						setLeaving(false)
						requestAnimationFrame(() => leaveButton.current?.focus())
					}}
					onConfirm={() => {
						if (!canQuery || leave.isPending || team.role !== 'member') return
						leave.mutate(
							{ teamId },
							{
								onSuccess: () => {
									void navigate('/settings', {
										replace: true,
										state: { focusId: 'settings-teams-title' },
									})
								},
							},
						)
					}}
				/>
			)}
		</main>
	)
}
