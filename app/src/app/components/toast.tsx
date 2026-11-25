import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function ToastViewport() {
	return (
		<div
			id="toast-viewport"
			className="pointer-events-none absolute inset-x-4 bottom-4 grid"
		/>
	)
}

export function Toast({ message }: { message: string }) {
	const [visible, setVisible] = useState(true)
	useEffect(() => {
		const timer = setTimeout(() => setVisible(false), 3500)
		return () => clearTimeout(timer)
	}, [])
	const viewport = document.getElementById('toast-viewport')
	if (!visible || !viewport) return null

	return createPortal(
		<div
			role="status"
			aria-atomic="true"
			className="[grid-area:1/1] rounded-md border border-white/10 bg-zinc-800 px-3 py-2 text-center text-xs"
		>
			{message}
		</div>,
		viewport,
	)
}
