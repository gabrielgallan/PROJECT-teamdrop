import { useEffect, useRef } from 'react'

interface InlineConfirmationProps {
	message: string
	confirmLabel: string
	onConfirm: () => void
	onCancel: () => void
	busy?: boolean
	error?: string
}

export function InlineConfirmation({
	message,
	confirmLabel,
	onConfirm,
	onCancel,
	busy = false,
	error = '',
}: InlineConfirmationProps) {
	const cancelButton = useRef<HTMLButtonElement>(null)
	useEffect(() => cancelButton.current?.focus(), [])

	return (
		<fieldset aria-label={message} className="w-full rounded-md bg-white/5 p-3">
			<p className="wrap-break-word text-xs leading-relaxed text-white/85">
				{message}
			</p>
			{error && (
				<p role="alert" className="mt-2 text-xs text-red-300">
					{error}
				</p>
			)}
			<div className="mt-2 flex flex-wrap justify-end gap-2 text-xs">
				<button
					ref={cancelButton}
					type="button"
					disabled={busy}
					onClick={onCancel}
					className="min-h-8 px-2 text-white/75 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-300"
				>
					Cancelar
				</button>
				<button
					type="button"
					disabled={busy}
					onClick={onConfirm}
					className="min-h-8 px-2 text-red-300 hover:bg-red-400/10 focus-visible:ring-2 focus-visible:ring-red-300"
				>
					{busy ? 'Aguarde…' : confirmLabel}
				</button>
			</div>
		</fieldset>
	)
}
