import { invoke, isTauri } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import type { TeamFile } from '../types/file'
import type { PendingFile } from '../types/team'
import { apiUrl } from './api'

export const isDesktop = isTauri
export const openFiles = () => open({ multiple: true })
export const quitApp = () => invoke<void>('quit_app')
export const copyText = (text: string) => navigator.clipboard.writeText(text)

export async function uploadContent(item: PendingFile): Promise<File> {
	if (item.file) return item.file
	if (!item.path) throw new Error('Arquivo indisponível.')
	// The native picker grants read access only to the files the user selected.
	const bytes = await readFile(item.path)
	const extension = item.name.split('.').pop()?.toLowerCase() ?? ''
	const types: Record<string, string> = {
		png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
		svg: 'image/svg+xml', pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown',
		json: 'application/json', csv: 'text/csv', zip: 'application/zip', mp4: 'video/mp4', mp3: 'audio/mpeg',
	}
	return new File([new Uint8Array(bytes).buffer], item.name, { type: types[extension] ?? 'application/octet-stream' })
}

export async function downloadFile(file: TeamFile): Promise<boolean> {
	if (isDesktop()) return invoke<boolean>('download_file', { fileId: file.id, fileName: file.name })
	const anchor = document.createElement('a')
	anchor.href = `${apiUrl}/api/files/${encodeURIComponent(file.id)}/download`
	anchor.download = file.name
	anchor.target = '_blank'
	anchor.rel = 'noopener'
	document.body.append(anchor)
	anchor.click()
	anchor.remove()
	return true
}
