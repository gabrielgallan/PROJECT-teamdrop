import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTeamFiles } from './use-team-files'
import { currentUser, screenshotSample } from '../mocks/team'
import { copyText, downloadFile, isDesktop, openFiles, quitApp } from '../services/desktop'
import type { PendingFile, SharedFile } from '../types/team'

export function useDrops() {
	const {
		team,
		files,
		pending,
		setPending,
		sharing,
		preparing,
		prepare,
		progress,
		markAsSeen,
		share,
	} = useTeamFiles()
	const busy = preparing || sharing
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const [preview, setPreview] = useState<SharedFile | null>(null)
	const [capture, setCapture] = useState<SharedFile | null>(null)
	const [now, setNow] = useState(Date.now)
	const dialogOpen = useRef(false)
	const activePreview = capture ?? preview
	const dropzone = useDropzone({
		noClick: true,
		noKeyboard: true,
		disabled: busy,
		onDrop: (accepted, rejected) => {
			if (accepted.length) {
				prepare(
					accepted.map(
						(file): PendingFile => ({
							id: crypto.randomUUID(),
							name: file.name,
							file,
							kind: file.type.startsWith('image/') ? 'image' : 'document',
						}),
					),
				)
			}
			setError(rejected.length ? 'Alguns arquivos não puderam ser selecionados.' : '')
		},
	})
	const { open: openBrowserPicker } = dropzone
	const selectFiles = useCallback(async () => {
		if (dialogOpen.current || busy) return
		if (!isDesktop()) {
			openBrowserPicker()
			return
		}
		dialogOpen.current = true
		try {
			const paths = await openFiles()
			if (paths?.length) {
				setPending(
					paths.map((path) => ({
						id: crypto.randomUUID(),
						name: path.split(/[\\/]/).pop() || path,
						path,
						kind: 'document',
					})),
				)
				setError('')
			}
		} catch {
			setError('Não foi possível abrir o seletor de arquivos.')
		} finally {
			dialogOpen.current = false
		}
	}, [openBrowserPicker, setPending, busy])

	const captureScreen = useCallback(() => {
		if (busy) return
		const id = crypto.randomUUID()
		const name = 'captura-de-tela.png'
		const url = screenshotSample()
		setPending([{ id, name, kind: 'image', url }])
		setCapture({
			id,
			name,
			url,
			kind: 'image',
			teamId: team.id,
			member: currentUser,
			size: 'Demo',
			createdAt: Date.now(),
			expiresAt: Date.now() + 3 * 86400000,
			link: `https://teamdrop.example/f/${id}`,
		})
		setError('')
	}, [busy, setPending, team.id])

	const quit = useCallback(async () => {
		try {
			await quitApp()
		} catch {
			setError('Não foi possível sair do aplicativo.')
		}
	}, [])

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 30000)
		return () => clearInterval(timer)
	}, [])
	useEffect(() => {
		if (!notice) return
		const timer = setTimeout(() => setNotice(''), 2500)
		return () => clearTimeout(timer)
	}, [notice])
	useEffect(() => {
		if (!sharing && capture && pending.length === 0) {
			setCapture(null)
			setNotice('Captura compartilhada com a equipe')
		}
	}, [sharing, capture, pending.length])
	useEffect(() => {
		function handleShortcut(event: KeyboardEvent) {
			if (event.key === 'Escape' && !sharing) {
				setPreview(null)
				if (capture) {
					setCapture(null)
					setPending([])
				}
				return
			}
			if (!event.ctrlKey || event.altKey || event.metaKey) return
			const key = event.key.toLowerCase()
			if (!['o', 'q'].includes(key) && !(event.shiftKey && key === 's')) return
			event.preventDefault()
			if (event.repeat) return
			if (key === 'q') void quit()
			else if (!preview && !capture && key === 'o') void selectFiles()
			else if (!preview && !capture && key === 's') captureScreen()
		}
		window.addEventListener('keydown', handleShortcut)
		return () => window.removeEventListener('keydown', handleShortcut)
	}, [selectFiles, captureScreen, quit, sharing, capture, preview, setPending])

	async function copyLink(file: SharedFile) {
		if (file.expiresAt <= Date.now()) {
			setError('Este arquivo expirou.')
			return
		}
		try {
			await copyText(file.link)
			setNotice('Link de demonstração copiado')
		} catch {
			setError('Não foi possível copiar o link.')
		}
	}
	function download(file: SharedFile) {
		if (file.expiresAt <= Date.now()) {
			setError('Este arquivo expirou.')
			return
		}
		downloadFile(file)
		setNotice('Download solicitado')
	}

	function closePreview() {
		setPreview(null)
		if (capture) {
			setCapture(null)
			setPending([])
		}
	}

	function openPreview(file: SharedFile) {
		markAsSeen(file.id)
		setPreview(file)
	}

	return {
		files,
		pending,
		sharing,
		preparing,
		progress,
		busy,
		dropzone,
		activePreview,
		capture,
		error,
		notice,
		now,
		selectFiles,
		quit,
		share,
		copyLink,
		download,
		closePreview,
		openPreview,
		clearSelection: () => setPending([]),
		dismissError: () => setError(''),
	}
}
