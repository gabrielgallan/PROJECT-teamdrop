import { invoke, isTauri } from '@tauri-apps/api/core'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'

export const isDesktop = isTauri
export const quitApp = () => invoke<void>('quit_app')
export const copyText = (text: string) =>
	isTauri() ? writeText(text) : navigator.clipboard.writeText(text)
