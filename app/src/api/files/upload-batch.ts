import type { PendingFile } from '../../types/file'

export async function uploadBatch(
	items: PendingFile[],
	signal: AbortSignal,
	send: (item: PendingFile, signal: AbortSignal) => Promise<unknown>,
	onConfirmed: (item: PendingFile) => void,
	onProgress: (current: number, total: number) => void,
) {
	for (const [index, item] of items.entries()) {
		signal.throwIfAborted()
		onProgress(index + 1, items.length)
		await send(item, signal)
		signal.throwIfAborted()
		onConfirmed(item)
	}
}
