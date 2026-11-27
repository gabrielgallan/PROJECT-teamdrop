import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useEffect, useId, useSyncExternalStore } from 'react'
import { toastQueue } from '../../lib/toast-queue'

export function ToastViewport() {
	const messages = useSyncExternalStore(
		toastQueue.subscribe,
		toastQueue.getSnapshot,
	)
	const current = messages[0]
	useEffect(() => {
		if (!current) return
		const timer = setTimeout(() => toastQueue.remove(current.id), 3500)
		return () => clearTimeout(timer)
	}, [current])
	useEffect(() => () => toastQueue.clear(), [])
	return (
		<div
			id="toast-viewport"
			className="pointer-events-none absolute inset-x-4 bottom-4"
		>
			<AnimatePresence mode="wait" initial={false}>
				{current && (
					<m.div
						key={current.id}
						initial={{ opacity: 0, y: 4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						role="status"
						aria-atomic="true"
						className="rounded-md border border-white/10 bg-zinc-800 px-3 py-2 text-center text-xs"
					>
						{current.message}
					</m.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export function Toast({ message }: { message: string }) {
	const id = useId()
	useEffect(() => {
		toastQueue.add(id, message)
		return () => toastQueue.remove(id)
	}, [id, message])
	return null
}
