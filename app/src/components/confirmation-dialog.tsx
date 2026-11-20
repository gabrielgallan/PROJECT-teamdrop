import { useRef } from 'react'
import { Dialog } from './dialog'

interface ConfirmationDialogProps {
	title: string
	message: string
	confirmLabel: string
	onConfirm: () => void
	onCancel: () => void
}

export function ConfirmationDialog({
	title,
	message,
	confirmLabel,
	onConfirm,
	onCancel,
}: ConfirmationDialogProps) {
	const cancelButton = useRef<HTMLButtonElement>(null)

	return (
		<Dialog open title={title} onClose={onCancel} initialFocusRef={cancelButton}>
			<p className="break-words text-xs leading-relaxed text-white/80">{message}</p>
			<div className="mt-5 flex flex-wrap justify-end gap-2 text-xs">
				<button
					ref={cancelButton}
					type="button"
					onClick={onCancel}
					className="min-h-8 px-3 text-white/75 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-indigo-300"
				>
					Cancelar
				</button>
				<button
					type="button"
					onClick={onConfirm}
					className="min-h-8 bg-rose-400 px-3 text-zinc-950 hover:bg-rose-300 focus-visible:ring-2 focus-visible:ring-rose-300"
				>
					{confirmLabel}
				</button>
			</div>
		</Dialog>
	)
}
