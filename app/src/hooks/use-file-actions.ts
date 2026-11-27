import { getFileUrl } from '../api/files/get-file-url'
import { useAccountMutation } from '../api/use-account-mutation'
import { authStore } from '../auth/auth.store'
import { copyText } from '../desktop/app.commands'
import { downloadFile, openFilePreview } from '../desktop/files.commands'
import type { TeamFile } from '../types/file'
import { useAuth } from './use-auth'

export function useFileActions() {
	const { session } = useAuth()
	function assertSession() {
		const state = authStore.getSnapshot()
		if (state.session !== session || state.busy !== null || state.needsLogin) {
			throw new DOMException('Session changed', 'AbortError')
		}
	}
	const preview = useAccountMutation(async ({ fileId }: { fileId: string }) => {
		const { url } = await getFileUrl({ fileId, type: 'preview' })
		assertSession()
		await openFilePreview(url)
	})
	const copy = useAccountMutation(async ({ fileId }: { fileId: string }) => {
		const { url } = await getFileUrl({ fileId, type: 'preview' })
		assertSession()
		await copyText(url)
	})
	const download = useAccountMutation(async (file: TeamFile) => {
		const { url } = await getFileUrl({ fileId: file.id, type: 'download' })
		assertSession()
		return downloadFile(file, url)
	})

	return { preview, copy, download }
}
