import { type ReactNode, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/use-auth'
import { useFilePicker } from '../../hooks/use-file-picker'
import { useSelectedTeam, useTeamUploadQueue } from '../../hooks/use-workspace'
import { FileDropzone } from './file-dropzone'
import {
	FolderInputIcon,
	type FolderInputIconHandle,
} from './icons/folder-input'
import { MenuItem } from './menu-item'
import { TeamSwitcher } from './team-switcher'
import { Toast } from './toast'

export function UploadPanel({ children }: { children: ReactNode }) {
	const folderIcon = useRef<FolderInputIconHandle>(null)
	const { canQuery } = useAuth()
	const { team } = useSelectedTeam()
	const queue = useTeamUploadQueue()
	const picker = useFilePicker(
		queue.prepare,
		!team || !canQuery || queue.sharing || queue.blocked,
	)
	const busy = picker.choosing || queue.sharing || queue.blocked || !canQuery
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
				success={queue.success || undefined}
			/>
			{queue.pending.length > 0 && !queue.sharing && !queue.blocked && (
				<div className="mx-4 flex items-center justify-between gap-2">
					<button
						type="button"
						onClick={() => void queue.share()}
						disabled={busy || !team}
						className="shrink-0 flex items-center gap-2 justify-center bg-indigo-400 transition-colors duration-200 w-full h-8 text-xs text-indigo-100 hover:bg-indigo-400/70"
					>
						<span className="truncate px-2" title={team?.name}>
							Compartilhar em {team?.name}
						</span>
					</button>
				</div>
			)}
			<div className="menu-group">
				<MenuItem
					disabled={busy || !team}
					onClick={() => void picker.selectFiles()}
					onMouseEnter={() => folderIcon.current?.startAnimation()}
					onMouseLeave={() => folderIcon.current?.stopAnimation()}
					aria-keyshortcuts="Control+O"
				>
					<FolderInputIcon
						ref={folderIcon}
						aria-hidden="true"
						size={16}
						className="shrink-0"
					/>
					Selecionar arquivos
					<span className="ml-auto text-xs text-white/55">Ctrl+O</span>
				</MenuItem>
				{children}
				<TeamSwitcher />
			</div>
			{queue.error && (
				<div className="px-4 py-2 text-xs">
					<p role="alert" className="text-red-300">
						{queue.error}
					</p>
					<div className="mt-2 flex gap-3">
						<button
							type="button"
							disabled={!canQuery || queue.sharing}
							onClick={queue.retry}
							className="text-indigo-200 underline focus-visible:ring-2 focus-visible:ring-indigo-300"
						>
							{queue.retryLabel}
						</button>
						<button
							type="button"
							disabled={queue.sharing}
							onClick={queue.dismissError}
							className="text-white/75 underline focus-visible:ring-2 focus-visible:ring-indigo-300"
						>
							Descartar
						</button>
					</div>
				</div>
			)}
			{queue.success && <Toast key={queue.success} message={queue.success} />}
		</>
	)
}
