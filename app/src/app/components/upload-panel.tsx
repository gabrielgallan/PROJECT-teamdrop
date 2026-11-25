import { FileInput, Loader2 } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'
import { useAuth } from '../../hooks/use-auth'
import { FileDropzone } from './file-dropzone'
import { MenuItem } from './menu-item'
import { TeamSwitcher } from './team-switcher'
import { useSelectedTeam, useTeamUploadQueue } from '../../hooks/use-workspace'
import { useFilePicker } from '../../hooks/use-file-picker'

export function UploadPanel({ children }: { children: ReactNode }) {
	const { canQuery } = useAuth()
	const { team } = useSelectedTeam()
	const queue = useTeamUploadQueue()
	const picker = useFilePicker(queue.prepare, !team || !canQuery || queue.sharing)
	const busy = picker.choosing || queue.sharing || !canQuery
	useEffect(() => {
		const shortcut = (event: KeyboardEvent) => {
			if (
				!event.ctrlKey ||
				event.altKey ||
				event.metaKey ||
				event.shiftKey ||
				event.key.toLowerCase() !== 'o'
			)
				return
			event.preventDefault()
			if (!event.repeat) void picker.selectFiles()
		}
		window.addEventListener('keydown', shortcut)
		return () => window.removeEventListener('keydown', shortcut)
	}, [picker.selectFiles])
	return (
		<>
			<FileDropzone
				dropzone={picker.dropzone}
				files={queue.pending}
				error={picker.error}
				onSelect={() => void picker.selectFiles()}
				onClear={queue.clear}
				disabled={busy || !team}
				status={queue.status || undefined}
			/>
			{queue.pending.length > 0 && (
				<div className="mx-4 flex items-center justify-between gap-2">
					<button
						type="button"
						onClick={() => void queue.share()}
						disabled={busy || !team}
						className="shrink-0 flex items-center gap-2 justify-center bg-indigo-400 transition-colors duration-200 w-full h-8 text-xs text-indigo-100 hover:bg-indigo-400/70"
					>
						{queue.sharing ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<span className="truncate px-2" title={team?.name}>
								Compartilhar em {team?.name}
							</span>
						)}
					</button>
				</div>
			)}
			<div className="menu-group">
				<TeamSwitcher />
				<MenuItem
					disabled={busy || !team}
					onClick={() => void picker.selectFiles()}
					aria-keyshortcuts="Control+O"
				>
					<FileInput aria-hidden="true" className="size-4" />
					Selecionar arquivos
					<span className="ml-auto text-xs text-white/55">Ctrl+O</span>
				</MenuItem>
				{children}
			</div>
			{queue.error && (
				<div role="alert" className="px-4 py-2 text-xs text-red-300">
					<button
						type="button"
						onClick={queue.dismissError}
						aria-label="Fechar erro"
						className="float-right px-1"
					>
						×
					</button>
					{queue.error}
				</div>
			)}
		</>
	)
}
