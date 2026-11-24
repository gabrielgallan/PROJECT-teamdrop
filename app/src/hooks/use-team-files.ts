import { useCallback, useEffect, useRef, useState } from 'react'
import { fileError, fileView, listFiles, uploadFile } from '../services/files'
import { uploadContent } from '../services/desktop'
import type { TeamFile } from '../types/file'
import type { PendingFile } from '../types/team'

interface Listing {
	teamId: string | null
	files: TeamFile[]
	nextCursor: string | null
	loading: boolean
	error: string
}
const empty = (teamId: string | null): Listing => ({ teamId, files: [], nextCursor: null, loading: Boolean(teamId), error: '' })

export function useTeamFiles(teamId: string | null) {
	const [listing, setListing] = useState<Listing>(() => empty(teamId))
	const [pending, setPending] = useState<PendingFile[]>([])
	const [sharing, setSharing] = useState(false)
	const [uploadStatus, setUploadStatus] = useState('')
	const [uploadError, setUploadError] = useState('')
	const request = useRef<AbortController | null>(null)
	const lastCursor = useRef<string | undefined>(undefined)
	const upload = useRef<AbortController | null>(null)
	const liveTeam = useRef(teamId)
	liveTeam.current = teamId

	const load = useCallback(async (cursor?: string) => {
		if (!teamId || (cursor && request.current)) return
		request.current?.abort()
		lastCursor.current = cursor
		const controller = new AbortController()
		request.current = controller
		setListing((previous) => ({ ...(previous.teamId === teamId ? previous : empty(teamId)), loading: true, error: '' }))
		try {
			const page = await listFiles(teamId, cursor, controller.signal)
			if (controller.signal.aborted || liveTeam.current !== teamId) return
			setListing((previous) => {
				const files = [...(cursor ? previous.files : []), ...page.files.map((file) => fileView(file, teamId))]
				return { teamId, files: files.filter((file, index) => files.findIndex((item) => item.id === file.id) === index), nextCursor: page.nextCursor, loading: false, error: '' }
			})
		} catch (error) {
			if (!controller.signal.aborted && liveTeam.current === teamId)
				setListing((previous) => ({ ...previous, loading: false, error: fileError(error) }))
		} finally {
			if (request.current === controller) request.current = null
		}
	}, [teamId])

	useEffect(() => {
		setListing(empty(teamId))
		setUploadError('')
		setSharing(false)
		void load()
		return () => { request.current?.abort(); upload.current?.abort() }
	}, [teamId, load])

	async function share() {
		if (!teamId || !pending.length || upload.current) return
		const controller = new AbortController()
		upload.current = controller
		setSharing(true)
		setUploadError('')
		const batch = [...pending]
		try {
			for (const [index, item] of batch.entries()) {
				setUploadStatus(`Enviando ${index + 1} de ${batch.length}…`)
				const file = await uploadContent(item)
				controller.signal.throwIfAborted()
				await uploadFile(teamId, file, controller.signal)
				if (controller.signal.aborted || liveTeam.current !== teamId) return
				// Confirmed successes leave the queue; a failed batch never resends them.
				setPending((previous) => previous.filter((value) => value.id !== item.id))
			}
		} catch (error) {
			if (!controller.signal.aborted && liveTeam.current === teamId) setUploadError(
				error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')
					? 'Envio não confirmado. Confira a lista antes de reenviar os arquivos restantes.'
					: fileError(error),
			)
		} finally {
			if (upload.current === controller) upload.current = null
			if (!controller.signal.aborted && liveTeam.current === teamId) {
				setSharing(false)
				setUploadStatus('')
				// Reload even after a lost response: the server may have accepted that file.
				await load()
			}
		}
	}

	const current = listing.teamId === teamId ? listing : empty(teamId)
	return {
		...current, pending, setPending, sharing, uploadStatus, uploadError,
		prepare: (batch: PendingFile[]) => { if (teamId && !upload.current) setPending(batch) },
		share,
		loadMore: () => { if (current.nextCursor) void load(current.nextCursor) },
		refresh: () => void load(),
		retry: () => void load(lastCursor.current),
		dismissUploadError: () => setUploadError(''),
	}
}
