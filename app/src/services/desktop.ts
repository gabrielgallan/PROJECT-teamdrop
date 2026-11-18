import { invoke, isTauri } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import type { SharedFile } from '../types/team'

export const isDesktop = isTauri

export function openFiles() {
	return open({ multiple: true })
}

export function quitApp() {
	return invoke<void>('quit_app')
}

export function copyText(text: string) {
	return navigator.clipboard.writeText(text)
}

export function downloadFile(file: SharedFile) {
	const anchor = document.createElement('a')
	anchor.href = file.url
	anchor.download =
		file.size === 'Demo' && file.kind === 'document' ? `${file.name}.demo.txt` : file.name
	document.body.append(anchor)
	anchor.click()
	anchor.remove()
}
