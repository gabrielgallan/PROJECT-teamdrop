import { Download, Ellipsis, Link, Loader2, QrCode } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { MenuItem } from './menu-item'

interface FileActionsMenuProps {
	fileId: string
	fileName: string
	disabled: boolean
	copying: boolean
	downloading: boolean
	onDownload: () => void
	onCopy: () => void
	onQrCode: () => void
}

export function FileActionsMenu({
	fileId,
	fileName,
	disabled,
	copying,
	downloading,
	onDownload,
	onCopy,
	onQrCode,
}: FileActionsMenuProps) {
	const id = useId()
	const trigger = useRef<HTMLButtonElement>(null)
	const popup = useRef<HTMLDivElement>(null)
	const focusLast = useRef(false)
	const [open, setOpen] = useState(false)
	const busy = copying || downloading

	function items() {
		return Array.from(
			popup.current?.querySelectorAll<HTMLButtonElement>(
				'[role="menuitem"]:not(:disabled)',
			) ?? [],
		)
	}

	function reposition() {
		const bounds = trigger.current?.getBoundingClientRect()
		const menu = popup.current
		if (!bounds || !menu) return
		const width = Math.min(192, window.innerWidth - 16)
		menu.style.width = `${width}px`
		const below = window.innerHeight - bounds.bottom - 12
		const above = bounds.top - 12
		menu.style.maxHeight = `${Math.max(0, Math.max(below, above))}px`
		const height = menu.getBoundingClientRect().height
		menu.style.top = `${below >= height ? bounds.bottom + 4 : Math.max(8, bounds.top - height - 4)}px`
		menu.style.left = `${Math.max(8, Math.min(bounds.right - width, window.innerWidth - width - 8))}px`
	}

	function close(restoreFocus = true) {
		popup.current?.hidePopover()
		if (restoreFocus) trigger.current?.focus({ preventScroll: true })
	}

	function show(last = false) {
		focusLast.current = last
		popup.current?.showPopover()
		reposition()
	}

	function choose(action: () => void) {
		close()
		action()
	}

	useEffect(() => {
		if (disabled) popup.current?.hidePopover()
	}, [disabled])

	useEffect(() => {
		if (!open) return
		function onScroll(event: Event) {
			if (event.target instanceof Node && popup.current?.contains(event.target))
				return
			close(false)
		}
		window.addEventListener('resize', reposition)
		window.addEventListener('scroll', onScroll, true)
		return () => {
			window.removeEventListener('resize', reposition)
			window.removeEventListener('scroll', onScroll, true)
		}
	}, [open])

	return (
		<>
			<button
				ref={trigger}
				id={`file-actions-${fileId}`}
				type="button"
				disabled={disabled}
				aria-label={`Ações de ${fileName}`}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={id}
				aria-busy={busy}
				title="Ações do arquivo"
				className="icon-button text-white/65 transition-colors hover:bg-white/10 hover:text-white aria-expanded:bg-white/10 aria-expanded:text-white"
				onClick={() => {
					if (open) close()
					else show()
				}}
				onKeyDown={(event) => {
					if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
					event.preventDefault()
					show(event.key === 'ArrowUp')
				}}
			>
				{busy ? (
					<Loader2
						className="animate-spin motion-reduce:animate-none"
						aria-hidden="true"
					/>
				) : (
					<Ellipsis aria-hidden="true" />
				)}
			</button>
			<div
				ref={popup}
				id={id}
				popover="auto"
				role="menu"
				aria-label={`Ações de ${fileName}`}
				className="file-actions-popover fixed inset-auto m-0 w-48 flex-col gap-1 overflow-y-auto rounded-md border border-white/10 bg-zinc-800 p-2 text-white/90"
				onToggle={(event) => {
					const visible = event.newState === 'open'
					setOpen(visible)
					if (visible) {
						const options = items()
						options[focusLast.current ? options.length - 1 : 0]?.focus({
							preventScroll: true,
						})
					}
				}}
				onKeyDown={(event) => {
					event.stopPropagation()
					if (event.key === 'Escape') {
						event.preventDefault()
						close()
						return
					}
					if (event.key === 'Tab') {
						close()
						return
					}
					if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
						return
					event.preventDefault()
					const options = items()
					if (!options.length) return
					const index = options.indexOf(
						document.activeElement as HTMLButtonElement,
					)
					const next =
						event.key === 'Home'
							? 0
							: event.key === 'End'
								? options.length - 1
								: (index +
										(event.key === 'ArrowUp' ? -1 : 1) +
										options.length) %
									options.length
					options[next].focus()
				}}
			>
				<MenuItem
					role="menuitem"
					tabIndex={-1}
					disabled={disabled || downloading}
					onClick={() => choose(onDownload)}
				>
					<Download aria-hidden="true" />
					Baixar
				</MenuItem>
				<MenuItem
					role="menuitem"
					tabIndex={-1}
					disabled={disabled || copying}
					onClick={() => choose(onCopy)}
				>
					<Link aria-hidden="true" />
					Copiar link
				</MenuItem>
				<MenuItem
					role="menuitem"
					tabIndex={-1}
					disabled={disabled}
					onClick={() => choose(onQrCode)}
				>
					<QrCode aria-hidden="true" />
					Exibir QR Code
				</MenuItem>
			</div>
		</>
	)
}
