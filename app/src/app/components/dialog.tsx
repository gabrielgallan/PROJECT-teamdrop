import { X } from 'lucide-react'
import { type ReactNode, type RefObject, useEffect, useId, useRef } from 'react'

interface DialogProps {
	open: boolean
	onClose: () => void
	title: string
	children: ReactNode
	initialFocusRef?: RefObject<HTMLElement | null>
}

export function Dialog({
	open,
	onClose,
	title,
	children,
	initialFocusRef,
}: DialogProps) {
	const dialog = useRef<HTMLDialogElement>(null)
	const titleId = useId()

	useEffect(() => {
		const element = dialog.current
		if (!element) return
		if (open && !element.open) {
			element.showModal()
			initialFocusRef?.current?.focus()
		} else if (!open && element.open) element.close()
	}, [open, initialFocusRef])

	return (
		<dialog
			ref={dialog}
			aria-labelledby={titleId}
			onClose={() => {
				if (open) onClose()
			}}
			onCancel={(event) => {
				event.preventDefault()
				onClose()
			}}
			onKeyDown={(event) => {
				if (event.key === 'Escape') event.stopPropagation()
				if (event.key !== 'Tab') return
				const targets = Array.from(
					event.currentTarget.querySelectorAll<HTMLElement>(
						'button, input, select, textarea, a[href], [tabindex]',
					),
				).filter(
					(element) =>
						!element.matches(':disabled') &&
						element.tabIndex >= 0 &&
						element.getClientRects().length > 0,
				)
				const first = targets[0]
				const last = targets[targets.length - 1]
				if (event.shiftKey && document.activeElement === first) {
					event.preventDefault()
					last?.focus()
				} else if (!event.shiftKey && document.activeElement === last) {
					event.preventDefault()
					first?.focus()
				}
			}}
			onClick={(event) => {
				if (event.target !== event.currentTarget) return
				const bounds = event.currentTarget.getBoundingClientRect()
				if (
					event.clientX < bounds.left ||
					event.clientX > bounds.right ||
					event.clientY < bounds.top ||
					event.clientY > bounds.bottom
				)
					onClose()
			}}
			className="m-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-xl border border-white/10 p-4 text-white/90 bg-zinc-800"
		>
			<div className="mb-4 flex items-center justify-between gap-3">
				<h2
					id={titleId}
					className="min-w-0 wrap-break-word text-sm font-medium"
				>
					{title}
				</h2>
				<button
					type="button"
					onClick={onClose}
					aria-label="Fechar diálogo"
					className="grid size-8 shrink-0 place-items-center text-white/65 hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-300"
				>
					<X size={16} aria-hidden="true" />
				</button>
			</div>
			{children}
		</dialog>
	)
}
