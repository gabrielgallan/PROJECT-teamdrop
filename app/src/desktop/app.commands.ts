import { invoke, isTauri } from '@tauri-apps/api/core'

export const isDesktop = isTauri
export const quitApp = () => invoke<void>('quit_app')
export const copyText = (text: string) => navigator.clipboard.writeText(text)
