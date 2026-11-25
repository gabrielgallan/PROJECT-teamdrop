import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { userTeamsQuery } from '../../api/teams/queries'
import { useAuth } from '../../hooks/use-auth'
import { useScreenBack } from '../../hooks/use-navigation'
import { errorMessage } from '../../lib/api-error'
import { AuthNotice } from '../components/auth-notice'
import { ScreenHeader } from '../components/screen-header'
import { Separator } from '../components/separator'
import { TeamInvites } from '../components/team-invites'
import { TeamMembers } from '../components/team-members'
import { TeamNameForm } from '../components/team-name-form'

export function TeamSettingsScreen() {
	const { teamId = '' } = useParams()
	return <TeamSettings key={teamId} teamId={teamId} />
}

function TeamSettings({ teamId }: { teamId: string }) {
	const { user, canQuery } = useAuth()
	const listing = useQuery({ ...userTeamsQuery(user.id), enabled: canQuery })
	const team = listing.data?.teams.find((item) => item.id === teamId)
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
				{listing.isPending && (
					<p role="status" className="mx-4 text-xs text-white/70">
						Carregando time…
					</p>
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
				{listing.isSuccess && team?.role !== 'owner' && (
					<p role="alert" className="mx-4 text-xs text-red-300">
						O time não está disponível para gerenciamento.
					</p>
				)}
				{team?.role === 'owner' && (
					<>
						<TeamNameForm team={team} />
						<TeamInvites teamId={teamId} />
					</>
				)}
			</header>
			{team?.role === 'owner' && (
				<>
					<Separator />
					<TeamMembers teamId={teamId} teamName={team.name} />
				</>
			)}
		</main>
	)
}
