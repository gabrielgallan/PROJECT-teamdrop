import { useId, useRef, useState } from 'react'
import { Dialog } from './dialog'

interface CreateTeamDialogProps {
	onClose: () => void
	onCreate: (name: string) => Promise<boolean | undefined>
	busy?: boolean
	error?: string
}

export function CreateTeamDialog({
	onClose,
	onCreate,
	busy = false,
	error = '',
}: CreateTeamDialogProps) {
	const [name, setName] = useState('')
	const nameId = useId()
	const nameInput = useRef<HTMLInputElement>(null)

	return (
		<Dialog
			open
			title="Criar novo time"
			onClose={() => {
				if (!busy) onClose()
			}}
			initialFocusRef={nameInput}
		>
			<form
				onSubmit={async (event) => {
					event.preventDefault()
					const trimmed = name.trim()
					if (!trimmed || busy) return
					if (await onCreate(trimmed)) onClose()
				}}
			>
				<label htmlFor={nameId} className="mb-2 block text-xs text-white/75">
					Nome
				</label>
				<input
					ref={nameInput}
					id={nameId}
					required
					value={name}
					disabled={busy}
					onChange={(event) => setName(event.target.value)}
					placeholder="Ex.: Equipe de produto"
					className="w-full min-w-0 rounded-md bg-white/5 px-3 py-2 text-sm placeholder:text-white/65 focus-visible:ring-2 focus-visible:ring-indigo-300"
				/>
				{error && (
					<p role="alert" className="mt-2 text-xs text-red-300">
						{error}
					</p>
				)}
				<div className="mt-5 flex flex-wrap justify-end gap-2 text-xs">
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
						disabled={busy || !name.trim()}
						className="min-h-8 bg-indigo-400 px-3 text-zinc-950! enabled:hover:bg-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-300"
					>
						{busy ? 'Criando…' : 'Criar'}
					</button>
				</div>
			</form>
		</Dialog>
	)
}
