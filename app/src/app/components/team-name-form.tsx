import { Save } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/use-auth'
import { ApiError, errorMessage } from '../../lib/api-error'
import { useUpdateTeam } from '../../api/teams/mutations'
import type { Team } from '../../types/team'
import { OperationFeedback } from './operation-feedback'

export function TeamNameForm({ team }: { team: Team }) {
	const [draft, setDraft] = useState(team.name)
	const mutation = useUpdateTeam()
	const { canQuery } = useAuth()
	const error = mutation.error instanceof ApiError && mutation.error.status === 409 ? 'Já existe um time com esse nome.' : errorMessage(mutation.error)
	return <form className="mx-4 mb-4" onSubmit={(event) => {
		event.preventDefault()
		if (!draft.trim() || draft.trim() === team.name || mutation.isPending || !canQuery) return
		mutation.mutate({ teamId: team.id, newName: draft.trim() }, { onSuccess: ({ team: updated }) => setDraft(updated.name) })
	}}>
		<label htmlFor="team-name" className="mb-2 block text-xs font-medium text-white/75">Nome do time</label>
		<div className="flex min-w-0 items-center gap-1 rounded-md bg-white/5 p-1">
			<input id="team-name" required value={draft} disabled={mutation.isPending || !canQuery} onChange={(event) => setDraft(event.target.value)}
				className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs text-white/85 focus-visible:ring-2 focus-visible:ring-indigo-300" />
			<button type="submit" disabled={mutation.isPending || !canQuery || !draft.trim() || draft.trim() === team.name}
				aria-label="Salvar nome do time" title="Salvar nome do time"
				className="grid size-8 shrink-0 place-items-center text-white/75 enabled:hover:bg-indigo-400 enabled:hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-300">
				<Save size={16} aria-hidden="true" />
			</button>
		</div>
		{error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
		{mutation.isSuccess && <OperationFeedback key={mutation.submittedAt} message="Nome do time atualizado." />}
	</form>
}
