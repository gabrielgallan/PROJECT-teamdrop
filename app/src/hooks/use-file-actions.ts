import { getFileUrl } from '../api/files/get-file-url'
import { useAccountMutation } from '../api/use-account-mutation'
import { authStore } from '../auth/auth.store'
import { copyText } from '../desktop/app.commands'
import { downloadFile } from '../desktop/files.commands'
import { useAuth } from './use-auth'

export function useFileActions() {
	const { session } = useAuth()
	const copy = useAccountMutation(async ({ fileId }: { fileId: string }) => {
		const { url } = await getFileUrl({ fileId })
		const state = authStore.getSnapshot()
		if (state.session !== session || state.busy !== null || state.needsLogin) {
			throw new DOMException('Session changed', 'AbortError')
		}
		await copyText(url)
	})
	const download = useAccountMutation(downloadFile)

	return { copy, download }
}
