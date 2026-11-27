import { ChevronDown, Clock3 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useUpdateTeam } from '../../api/teams/mutations'
import { useAuth } from '../../hooks/use-auth'
import { errorMessage } from '../../lib/api-error'
import type { Team } from '../../types/team'
import { Dialog } from './dialog'
import { ExpirationPicker, formatExpiration } from './expiration-picker'
import { OperationFeedback } from './operation-feedback'

export function TeamRetentionForm({ team }: { team: Team }) {
	const [open, setOpen] = useState(false)
	const [selected, setSelected] = useState(team.storageRetentionSeconds)
	const mutation = useUpdateTeam()
	const { canQuery } = useAuth()
	const trigger = useRef<HTMLButtonElement>(null)
	const initialOption = useRef<HTMLDivElement>(null)
	const id = useId()
	const disabled = !canQuery || team.role !== 'owner' || mutation.isPending

	const canSave =
		!disabled &&
		selected !== team.storageRetentionSeconds &&
		Number.isInteger(selected) &&
		selected >= 900 &&
		selected <= 259200

	function close() {
		setOpen(false)
		requestAnimationFrame(() => trigger.current?.focus())
	}

	return (
		<div className="mx-4 mb-4">
			<p id={id} className="mb-2 text-xs font-medium text-white/75">
				Retenção de arquivos
			</p>
			<button
				ref={trigger}
				type="button"
				disabled={disabled}
				aria-labelledby={`${id} ${id}-value`}
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => {
					setSelected(team.storageRetentionSeconds)
					mutation.reset()
					setOpen(true)
				}}
				className="flex min-h-10 w-full items-center gap-2.5 rounded-md bg-white/5 px-3 text-xs text-white/85 transition-colors duration-150 enabled:hover:bg-white/10 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-300 motion-reduce:transition-none"
			>
				<Clock3
					size={16}
					className="shrink-0 text-white/60"
					aria-hidden="true"
				/>
				<span id={`${id}-value`} className="flex-1 text-left">
					{formatExpiration(team.storageRetentionSeconds)}
				</span>
				<ChevronDown
					size={14}
					className="shrink-0 text-white/60"
					aria-hidden="true"
				/>
			</button>
			{mutation.isSuccess && (
				<OperationFeedback
					key={mutation.submittedAt}
					message="Retenção atualizada."
				/>
			)}
			{open && (
				<Dialog
					open
					title="Retenção de arquivos"
					initialFocusRef={initialOption}
					onClose={() => {
						if (!mutation.isPending) close()
					}}
				>
					<form
						aria-busy={mutation.isPending}
						onSubmit={(event) => {
							event.preventDefault()
							if (!canSave) return
							mutation.mutate(
								{ teamId: team.id, storageRetentionSeconds: selected },
								{ onSuccess: close },
							)
						}}
					>
						<ExpirationPicker
							ref={initialOption}
							value={selected}
							disabled={disabled}
							onValueChange={(value) => {
								setSelected(value)
								mutation.reset()
							}}
						/>
						{mutation.error && (
							<p role="alert" className="mt-3 text-xs text-red-300">
								{errorMessage(mutation.error)}
							</p>
						)}
						<div className="mt-4 flex justify-end gap-2 text-xs">
							<button
								type="button"
								disabled={mutation.isPending}
								onClick={close}
								className="min-h-9 rounded-md px-3 text-white/75 enabled:hover:bg-white/5 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-300"
							>
								Cancelar
							</button>
							<button
								type="submit"
								disabled={!canSave}
								className="min-h-9 rounded-md bg-indigo-400 px-4 font-medium text-zinc-950 enabled:hover:bg-indigo-300 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-300"
							>
								{mutation.isPending ? 'Salvando…' : 'Aplicar'}
							</button>
						</div>
					</form>
				</Dialog>
			)}
		</div>
	)
}
