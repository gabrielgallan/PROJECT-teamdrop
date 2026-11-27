import { uploadBatch } from '../api/files/upload-batch'
import type { ApiFile, PendingFile } from '../types/file'

export interface UploadJob {
	teamId: string
	pending: PendingFile[]
	autoCopy: boolean
	lastItemId: string
	lastFileId: string | null
	stage: 'upload' | 'copy'
	failed: boolean
}

interface UploadJobDependencies {
	send: (item: PendingFile, signal: AbortSignal) => Promise<ApiFile>
	onConfirmed: (item: PendingFile, file: ApiFile) => void
	onProgress: (current: number, total: number) => void
	onCopy: () => void
	assertActive: () => void
	getUrl: (fileId: string, signal: AbortSignal) => Promise<{ url: string }>
	copy: (url: string) => Promise<void>
}

export function createUploadJob(
	teamId: string,
	items: PendingFile[],
	autoCopy: boolean,
): UploadJob {
	return {
		teamId,
		pending: [...items],
		autoCopy,
		lastItemId: items[items.length - 1]?.id ?? '',
		lastFileId: null,
		stage: 'upload',
		failed: false,
	}
}

export async function runUploadJob(
	job: UploadJob,
	signal: AbortSignal,
	dependencies: UploadJobDependencies,
) {
	const assertActive = () => {
		signal.throwIfAborted()
		dependencies.assertActive()
	}
	assertActive()
	job.stage = 'upload'
	await uploadBatch(
		[...job.pending],
		signal,
		async (item, signal) => {
			assertActive()
			return dependencies.send(item, signal)
		},
		(item, file) => {
			assertActive()
			job.pending = job.pending.filter((pending) => pending.id !== item.id)
			if (item.id === job.lastItemId) job.lastFileId = file.id
			dependencies.onConfirmed(item, file)
		},
		dependencies.onProgress,
	)
	if (!job.autoCopy) return
	assertActive()
	if (!job.lastFileId) throw new Error('Last file was not confirmed')
	job.stage = 'copy'
	dependencies.onCopy()
	const { url } = await dependencies.getUrl(job.lastFileId, signal)
	assertActive()
	await dependencies.copy(url)
}
