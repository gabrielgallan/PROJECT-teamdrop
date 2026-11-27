interface ToastMessage {
	id: string
	message: string
}

export function createToastQueue() {
	let messages: ToastMessage[] = []
	const listeners = new Set<() => void>()
	function publish(next: ToastMessage[]) {
		messages = next
		for (const listener of listeners) listener()
	}
	return {
		getSnapshot: () => messages,
		subscribe(listener: () => void) {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		add(id: string, message: string) {
			if (messages.some((item) => item.id === id)) return
			const pending =
				messages.length >= 4 ? [messages[0], ...messages.slice(-2)] : messages
			publish([...pending, { id, message }])
		},
		remove(id: string) {
			if (messages.some((item) => item.id === id)) {
				publish(messages.filter((item) => item.id !== id))
			}
		},
		clear() {
			publish([])
		},
	}
}

export const toastQueue = createToastQueue()
