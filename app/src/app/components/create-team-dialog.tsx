import { useId, useRef, useState } from 'react'
import { useCreateTeam } from '../../api/teams/mutations'
import { useAuth } from '../../hooks/use-auth'
import { ApiError, errorMessage } from '../../lib/api-error'
import { Dialog } from './dialog'

export function CreateTeamDialog({ onClose }: { onClose: () => void }) {
	const [name, setName] = useState('')
	const mutation = useCreateTeam()
	const { canQuery } = useAuth()
	const nameId = useId()
	const input = useRef<HTMLInputElement>(null)
	const busy = mutation.isPending
	const error =
		mutation.error instanceof ApiError && mutation.error.status === 409
			? 'Já existe um time com esse nome.'
			: errorMessage(mutation.error)
	return (
		<Dialog
			open
			title="Criar novo time"
			onClose={() => {
				if (!busy) onClose()
			}}
			initialFocusRef={input}
		>
			<form
				onSubmit={(event) => {
					event.preventDefault()
					if (name.trim() && !busy && canQuery)
						mutation.mutate({ name: name.trim() }, { onSuccess: onClose })
				}}
			>
				<label htmlFor={nameId} className="mb-2 block text-xs text-white/75">
					Nome
				</label>
				<input
					ref={input}
					id={nameId}
					required
					value={name}
					disabled={busy || !canQuery}
					onChange={(event) => setName(event.target.value)}
					placeholder="Ex.: Equipe de produto"
					className="w-full min-w-0 rounded-md bg-white/5 px-3 py-2 text-sm placeholder:text-white/65 focus-visible:ring-2 focus-visible:ring-indigo-300"
				/>
				{error && (
					<p role="alert" className="mt-2 text-xs text-red-300">
						{error}
					</p>
				)}
				<div className="mt-4 flex flex-wrap justify-end gap-2 text-xs">
					<button
						type="button"
						onClick={onClose}
						disabled={busy}
						className="min-h-8 px-3 text-white/75 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-indigo-300"
					>
						Cancelar
					</button>
					<button
						type="submit"
						disabled={busy || !canQuery || !name.trim()}
						className="min-h-8 bg-indigo-400 px-3 text-zinc-950! enabled:hover:bg-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-300"
					>
						{busy ? 'Criando…' : 'Criar'}
					</button>
				</div>
			</form>
		</Dialog>
	)
}
