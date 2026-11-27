import type { PendingFile } from '../../types/file'

export async function uploadBatch<T>(
	items: PendingFile[],
	signal: AbortSignal,
	send: (item: PendingFile, signal: AbortSignal) => Promise<T>,
	onConfirmed: (item: PendingFile, result: T) => void,
	onProgress: (current: number, total: number) => void,
) {
	for (const [index, item] of items.entries()) {
		signal.throwIfAborted()
		onProgress(index + 1, items.length)
		const result = await send(item, signal)
		signal.throwIfAborted()
		onConfirmed(item, result)
	}
}
