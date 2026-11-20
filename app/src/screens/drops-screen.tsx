import { FileInput, Loader2, Power, Settings } from 'lucide-react'
import { useRef, useState } from 'react'
import { FileDropzone } from '../components/file-dropzone'
import { FilePreview } from '../components/file-preview'
import { MenuItem } from '../components/menu-item'
import { RecentFiles } from '../components/recent-files'
import { useDrops } from '../hooks/use-drops'
import { useTeamSettings } from '../hooks/use-team-settings'
import type { SessionUser } from '../types/auth'
import { SettingsScreen } from './settings-screen'

export function DropsScreen({
	user,
	onLogout,
	authBusy,
	authError,
	authNeedsLogin,
	onAuthRetry,
}: {
	user: SessionUser
	onLogout: () => void
	authBusy: boolean
	authError: string
	authNeedsLogin: boolean
	onAuthRetry: () => void
}) {
	const [settingsOpen, setSettingsOpen] = useState(false)
	const settingsButton = useRef<HTMLButtonElement>(null)
	const teamSettings = useTeamSettings(user)
	const {
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
		clearSelection,
		dismissError,
	} = useDrops(!settingsOpen)

	if (settingsOpen) {
		return (
			<SettingsScreen
				teams={teamSettings.teams}
				onCreateTeam={teamSettings.createTeam}
				onLeaveTeam={teamSettings.leaveTeam}
				onCreateInvite={teamSettings.createInvite}
				onRevokeInvite={teamSettings.revokeInvite}
				onRenameTeam={teamSettings.renameTeam}
				onRemoveMember={teamSettings.removeMember}
				user={user}
				onBack={() => {
					setSettingsOpen(false)
					requestAnimationFrame(() => settingsButton.current?.focus())
				}}
				onLogout={onLogout}
				authBusy={authBusy}
				authError={authError}
			/>
		)
	}

	return (
		<main className="relative flex h-full flex-col overflow-hidden bg-zinc-900/50 text-white/90">
			{activePreview ? (
				<FilePreview
					file={activePreview}
					onBack={closePreview}
					onCopy={copyLink}
					onDownload={download}
					onShare={capture ? () => share() : undefined}
					sharing={sharing}
				/>
			) : (
				<>
					<div className="shrink-0 space-y-3 pt-4">
						<FileDropzone
							dropzone={dropzone}
							files={pending}
							error=""
							onSelect={selectFiles}
							onClear={clearSelection}
							disabled={busy}
							progress={busy ? progress : undefined}
							progressLabel={preparing ? 'Preparando arquivos' : 'Compartilhando arquivos'}
						/>
						{pending.length > 0 && (
							<div className="mx-4 flex items-center justify-between gap-2">
								<button
									type="button"
									onClick={() => share()}
									disabled={busy}
									className="shrink-0 flex items-center gap-2 justify-center bg-indigo-400 transition-colors duration-200 w-full h-8 text-xs text-indigo-100 hover:bg-indigo-400/70"
								>
									{sharing ? <Loader2 className="size-4 animate-spin" /> : <>Compartilhar</>}
								</button>
							</div>
						)}

						<div className="mx-2">
							<MenuItem disabled={busy} onClick={selectFiles} aria-keyshortcuts="Control+O">
								<FileInput aria-hidden="true" className="size-4" />
								Selecionar arquivos
								<span className="ml-auto text-xs text-white/55">Ctrl+O</span>
							</MenuItem>
							<MenuItem ref={settingsButton} onClick={() => setSettingsOpen(true)}>
								<Settings aria-hidden="true" className="size-4" />
								Configurações
							</MenuItem>
							<MenuItem onClick={quit} aria-keyshortcuts="Control+Q">
								<Power aria-hidden="true" className="size-4" />
								Sair
								<span className="ml-auto text-xs text-white/55">Ctrl+Q</span>
							</MenuItem>
						</div>
						<div className="mx-4 flex items-center justify-between border-t border-white/8 pb-1 pt-4">
							<h2 className="text-xs font-medium text-white/75">Drops do time</h2>
						</div>
					</div>
					<RecentFiles files={files} now={now} onPreview={openPreview} onCopy={copyLink} />
				</>
			)}
			{authError && (
				<div role="alert" className="px-4 py-2 text-xs text-red-300">
					<p>{authError}</p>
					<button
						type="button"
						disabled={authBusy}
						onClick={onAuthRetry}
						className="mt-2 underline"
					>
						{authNeedsLogin ? 'Entrar novamente' : 'Tentar novamente'}
					</button>
				</div>
			)}
			{error && (
				<div
					role="alert"
					className="shrink-0 border-t border-white/10 bg-zinc-900 px-4 py-2 text-xs text-red-300"
				>
					<button
						type="button"
						onClick={dismissError}
						className="float-right px-1"
						aria-label="Fechar erro"
					>
						×
					</button>
					{error}
				</div>
			)}
			{notice && (
				<div
					role="status"
					className="pointer-events-none absolute inset-x-4 bottom-4 rounded-md border border-white/10 bg-zinc-800 px-3 py-2 text-center text-xs"
				>
					{notice}
				</div>
			)}
		</main>
	)
}
