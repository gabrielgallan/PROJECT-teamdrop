import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { isDesktop } from '../desktop/app.commands'
import { openFiles } from '../desktop/files.commands'
import type { PendingFile } from '../types/file'

export function useFilePicker(
	prepare: (items: PendingFile[]) => void,
	disabled: boolean,
) {
	const [choosing, setChoosing] = useState(false)
	const [error, setError] = useState('')
	const lock = useRef(false)
	const generation = useRef(0)
	useEffect(
		() => () => {
			generation.current++
		},
		[],
	)
	useEffect(() => {
		if (disabled) generation.current++
	}, [disabled])
	const dropzone = useDropzone({
		noClick: true,
		noKeyboard: true,
		disabled: disabled || choosing,
		onDrop: (accepted, rejected) => {
			prepare(
				accepted.map((file) => ({
					id: crypto.randomUUID(),
					name: file.name,
					file,
					kind: file.type.startsWith('image/') ? 'image' : 'document',
				})),
			)
			setError(
				rejected.length ? 'Alguns arquivos não puderam ser selecionados.' : '',
			)
		},
	})
	const openBrowser = dropzone.open
	const selectFiles = useCallback(async () => {
		if (disabled || lock.current) return
		if (!isDesktop()) {
			openBrowser()
			return
		}
		lock.current = true
		setChoosing(true)
		const attempt = generation.current
		try {
			const paths = await openFiles()
			if (attempt === generation.current && paths?.length)
				prepare(
					paths.map((path) => ({
						id: crypto.randomUUID(),
						name: path.split(/[\\/]/).pop() || path,
						path,
						kind: 'document',
					})),
				)
		} catch {
			if (attempt === generation.current)
				setError('Não foi possível abrir o seletor de arquivos.')
		} finally {
			lock.current = false
			setChoosing(false)
		}
	}, [disabled, openBrowser, prepare])
	return { dropzone, choosing, error, selectFiles }
}
