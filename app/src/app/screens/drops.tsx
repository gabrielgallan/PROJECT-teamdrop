import { Power, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { quitApp } from '../../desktop/app.commands'
import { AuthNotice } from '../components/auth-notice'
import { MenuItem } from '../components/menu-item'
import { RecentFiles } from '../components/recent-files'
import { Separator } from '../components/separator'
import { UploadPanel } from '../components/upload-panel'

export function DropsScreen() {
	const navigate = useNavigate()
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
					<MenuItem id="settings-button" onClick={() => void navigate('/settings')}>
						<Settings aria-hidden="true" className="size-4" />
						Configurações
					</MenuItem>
					<MenuItem onClick={() => void quit()} aria-keyshortcuts="Control+Q">
						<Power aria-hidden="true" className="size-4" />
						Sair<span className="ml-auto text-xs text-white/55">Ctrl+Q</span>
					</MenuItem>
				</UploadPanel>
				<Separator />
			</div>
			<h2 className="section-title truncate">Recentes</h2>
			<RecentFiles />
			<AuthNotice />
			{error && (
				<p role="alert" className="px-4 py-2 text-xs text-red-300">
					{error}
				</p>
			)}
		</main>
	)
}
