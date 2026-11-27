import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { quitApp } from '../../desktop/app.commands'
import { AuthNotice } from '../components/auth-notice'
import {
	SettingsIcon,
	type SettingsIconHandle,
} from '../components/icons/settings'
import { MenuItem } from '../components/menu-item'
import { RealtimeNotice } from '../components/realtime-notice'
import { RecentFiles } from '../components/recent-files'
import { Separator } from '../components/separator'
import { ToastViewport } from '../components/toast'
import { UploadPanel } from '../components/upload-panel'

export function DropsScreen() {
	const navigate = useNavigate()
	const settingsIcon = useRef<SettingsIconHandle>(null)
	const [error, setError] = useState('')
	async function quit() {
		try {
			await quitApp()
		} catch {
			setError('Não foi possível sair do aplicativo.')
		}
	}
	useEffect(() => {
		function shortcut(event: KeyboardEvent) {
			if (
				!event.ctrlKey ||
				event.altKey ||
				event.metaKey ||
				event.shiftKey ||
				event.key.toLowerCase() !== 'q'
			)
				return
			event.preventDefault()
			if (!event.repeat) void quit()
		}
		window.addEventListener('keydown', shortcut)
		return () => window.removeEventListener('keydown', shortcut)
	}, [])
	return (
		<main className="relative h-full flex flex-col overflow-hidden bg-zinc-900/50 text-white/90">
			<div className="shrink-0 space-y-4 pt-4">
				<UploadPanel>
					<MenuItem
						id="settings-button"
						onClick={() => void navigate('/settings')}
						onMouseEnter={() => settingsIcon.current?.startAnimation()}
						onMouseLeave={() => settingsIcon.current?.stopAnimation()}
					>
						<SettingsIcon
							ref={settingsIcon}
							aria-hidden="true"
							size={16}
							className="shrink-0"
						/>
						Configurações
					</MenuItem>
				</UploadPanel>
				<Separator />
			</div>
			<div className="mx-4 mb-2 mt-4 flex items-center justify-between gap-2">
				<h2 className="truncate text-xs font-medium text-white/75">Recentes</h2>
				<RealtimeNotice />
			</div>
			<RecentFiles />
			<AuthNotice />
			{error && (
				<p role="alert" className="px-4 py-2 text-xs text-red-300">
					{error}
				</p>
			)}
			<ToastViewport />
		</main>
	)
}
