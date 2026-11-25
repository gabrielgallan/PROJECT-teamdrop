import { useQuery } from '@tanstack/react-query'
import { Crown, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/use-auth'
import { errorMessage } from '../../lib/api-error'
import { useRemoveTeamMember } from '../../api/teams/mutations'
import { getTeamMembers } from '../../api/teams/get-team-members'
import { queryKeys } from '../../api/query-keys'
import { memberView } from '../utils/presentation'
import { Avatar } from './avatar'
import { ConfirmationDialog } from './confirmation-dialog'
import { ListSkeleton } from './skeleton'

export function TeamMembers({ teamId, teamName, canManage }: { teamId: string; teamName: string; canManage: boolean }) {
	const { user, canQuery } = useAuth()
	const listing = useQuery({
		queryKey: queryKeys.members(user.id, teamId),
		queryFn: ({ signal }) => getTeamMembers({ teamId }, signal),
		enabled: canQuery,
	})
	const remove = useRemoveTeamMember()
	const [pendingId, setPendingId] = useState<string | null>(null)
	const pending = listing.data?.users.find((member) => member.id === pendingId)
	const close = () => {
		setPendingId(null)
		remove.reset()
		requestAnimationFrame(() => document.getElementById(`remove-member-${pendingId}`)?.focus())
	}
	return <>
		<h2 id="team-members-title" tabIndex={-1} className="section-title">Membros</h2>
		<section aria-labelledby="team-members-title" aria-busy={listing.isFetching} className="shrink-0 px-2 pb-4">
			{listing.isPending && canQuery && <ListSkeleton variant="member" />}
			{listing.error && <div role="alert" className="px-2 text-xs text-red-300">{errorMessage(listing.error)}{' '}
				<button type="button" disabled={!canQuery || listing.isFetching} onClick={() => void listing.refetch()} className="underline">Atualizar membros</button>
			</div>}
			<ul className="item-list">{listing.data?.users.map((member) => {
				const view = memberView(member)
				return <li key={member.id}><div className="list-row">
					<Avatar member={view} className={`size-9 ${view.color}`} />
					<span className="min-w-0 flex-1 truncate text-ui" title={view.name}>{member.id === user.id ? 'Você' : view.name}</span>
					{member.role === 'owner' ? <span className="grid size-8 shrink-0 place-items-center text-indigo-400" title="Proprietário"><Crown size={16} aria-hidden="true" /><span className="sr-only">Proprietário</span></span>
						: canManage ? <button id={`remove-member-${member.id}`} type="button" disabled={!canQuery || remove.isPending}
							onClick={() => { remove.reset(); setPendingId(member.id) }} aria-label={`Remover ${view.name}`} title={`Remover ${view.name}`}
							className="icon-button text-white/60 hover:bg-white/5 hover:text-white"><X size={16} aria-hidden="true" /></button> : null}
				</div></li>
			})}</ul>
		</section>
		{pending && canManage && <ConfirmationDialog title="Remover membro" message={`Remover ${pending.name || pending.email} do time ${teamName}?`} confirmLabel="Remover membro"
			busy={remove.isPending} error={errorMessage(remove.error)} onCancel={() => { if (!remove.isPending) close() }}
			onConfirm={() => { if (canManage && canQuery && !remove.isPending) remove.mutate({ teamId, memberId: pending.id }, { onSuccess: () => {
				setPendingId(null)
				requestAnimationFrame(() => document.getElementById('team-members-title')?.focus())
			} }) }} />}
	</>
}
