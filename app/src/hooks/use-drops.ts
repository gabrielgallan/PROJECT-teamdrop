import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTeamFiles } from './use-team-files'
import { fileError, generateFileUrl } from '../services/files'
import { copyText, downloadFile, isDesktop, openFiles, quitApp } from '../services/desktop'
import type { TeamFile } from '../types/file'
import type { PendingFile, SettingsTeam } from '../types/team'

export function useDrops(team: Pick<SettingsTeam, 'id' | 'name'> | null, active = true) {
	const listing = useTeamFiles(team?.id ?? null)
	const { pending, setPending, sharing, prepare } = listing
	const [choosing, setChoosing] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const [copyingId, setCopyingId] = useState<string | null>(null)
	const [downloadingId, setDownloadingId] = useState<string | null>(null)
	const [now, setNow] = useState(Date.now)
	const dialogOpen = useRef(false)
	const copyLock = useRef(false)
	const downloadLock = useRef(false)
	const busy = sharing || choosing
	const dropzone = useDropzone({
		noClick: true, noKeyboard: true, disabled: busy || !active || !team,
		onDrop: (accepted, rejected) => {
			if (accepted.length) prepare(accepted.map((file): PendingFile => ({
				id: crypto.randomUUID(), name: file.name, file,
				kind: file.type.startsWith('image/') ? 'image' : 'document',
			})))
			setError(rejected.length ? 'Alguns arquivos não puderam ser selecionados.' : '')
		},
	})
	const { open: openBrowserPicker } = dropzone
	const selectFiles = useCallback(async () => {
		if (dialogOpen.current || busy || !team || !active) return
		if (!isDesktop()) { openBrowserPicker(); return }
		dialogOpen.current = true
		setChoosing(true)
		try {
			const paths = await openFiles()
			if (paths?.length) setPending(paths.map((path) => ({
				id: crypto.randomUUID(), name: path.split(/[\\/]/).pop() || path, path, kind: 'document',
			})))
		} catch { setError('Não foi possível abrir o seletor de arquivos.') }
		finally { dialogOpen.current = false; setChoosing(false) }
	}, [openBrowserPicker, setPending, busy, team?.id, active])
	const quit = useCallback(async () => {
		try { await quitApp() } catch { setError('Não foi possível sair do aplicativo.') }
	}, [])
	useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer) }, [])
	useEffect(() => {
		if (!notice) return
		const timer = setTimeout(() => setNotice(''), 3500)
		return () => clearTimeout(timer)
	}, [notice])
	useEffect(() => { setError(''); setNotice('') }, [team?.id])
	useEffect(() => {
		if (!active) return
		function shortcut(event: KeyboardEvent) {
			if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || !['o', 'q'].includes(event.key.toLowerCase())) return
			event.preventDefault()
			if (event.repeat) return
			if (event.key.toLowerCase() === 'q') void quit()
			else void selectFiles()
		}
		window.addEventListener('keydown', shortcut)
		return () => window.removeEventListener('keydown', shortcut)
	}, [active, quit, selectFiles])

	async function copyLink(file: TeamFile) {
		if (copyLock.current) return
		copyLock.current = true
		setCopyingId(file.id)
		try {
			await copyText(await generateFileUrl(file.id))
			setNotice('Link copiado · válido por 5 minutos')
		} catch (error) { setError(fileError(error)) }
		finally { copyLock.current = false; setCopyingId(null) }
	}
	async function download(file: TeamFile) {
		if (downloadLock.current) return
		downloadLock.current = true
		setDownloadingId(file.id)
		try {
			if (await downloadFile(file)) setNotice(isDesktop() ? 'Arquivo salvo' : 'Download solicitado')
		} catch (error) { setError(typeof error === 'string' ? error : fileError(error)) }
		finally { downloadLock.current = false; setDownloadingId(null) }
	}
	return {
		...listing, pending, sharing, busy, dropzone, notice, now, selectFiles, quit, copyLink, download,
		copyingId, downloadingId, listingError: listing.error, error: error || listing.uploadError,
		clearSelection: () => setPending([]),
		dismissError: () => { setError(''); listing.dismissUploadError() },
	}
}
