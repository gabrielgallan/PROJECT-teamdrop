import { FileInput, Loader2, Power, Settings } from 'lucide-react'
import { useRef, useState } from 'react'
import { FileDropzone } from '../components/file-dropzone'
import { MenuItem } from '../components/menu-item'
import { RecentFiles } from '../components/recent-files'
import { Separator } from '../components/separator'
import { TeamSwitcher } from '../components/team-switcher'
import { useDrops } from '../hooks/use-drops'
import { useSelectedTeam } from '../hooks/use-selected-team'
import type { TeamActions } from '../hooks/use-team-settings'
import type { TeamFile } from '../types/file'
import { FileQrScreen } from './file-qr-screen'
import { SettingsScreen } from './settings-screen'
import { useAuth } from '../auth/use-auth'

interface DropsScreenProps {
	teamSettings: TeamActions
	settingsOpen: boolean
	onSettingsChange: (value: boolean) => void
}

export function DropsScreen({
	teamSettings,
	settingsOpen,
	onSettingsChange: setSettingsOpen,
}: DropsScreenProps) {
	const { session, busy: authBusy, error: authError } =
		useAuth()

	const settingsButton = useRef<HTMLButtonElement>(null)
	const [qrFile, setQrFile] = useState<TeamFile | null>(null)
	const qrTrigger = useRef<HTMLButtonElement | null>(null)
	const filesList = useRef<HTMLElement>(null)
	const savedScroll = useRef(0)
	const { team, selectTeam } = useSelectedTeam(
		session.user.id,
		teamSettings.teams,
		!teamSettings.loading && !teamSettings.error,
	)
	const {
		files,
		pending,
		sharing,
		busy,
		loading,
		listingError,
		nextCursor,
		loadMore,
		retry,
		uploadStatus,
		copyingId,
		downloadingId,
		dropzone,
		error,
		notice,
		now,
		selectFiles,
		quit,
		share,
		copyLink,
		download,
		clearSelection,
		dismissError,
	} = useDrops(team, !settingsOpen && !qrFile)

	if (settingsOpen) {
		return (
			<SettingsScreen
				actions={teamSettings}
				user={session.user}
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
		<>
			{qrFile && (
				<FileQrScreen
					key={qrFile.id}
					file={qrFile}
					onBack={() => {
						setQrFile(null)
						requestAnimationFrame(() => {
							if (filesList.current) filesList.current.scrollTop = savedScroll.current
							qrTrigger.current?.focus({ preventScroll: true })
						})
					}}
				/>
			)}
			<main
				hidden={Boolean(qrFile)}
				className={`relative h-full flex-col overflow-hidden bg-zinc-900/50 text-white/90 ${qrFile ? 'hidden' : 'flex'}`}
			>
				<div className="shrink-0 space-y-4 pt-4">
					<FileDropzone
						dropzone={dropzone}
						files={pending}
						error=""
						onSelect={selectFiles}
						onClear={clearSelection}
						disabled={busy || !team}
						status={sharing ? uploadStatus : undefined}
					/>
					{pending.length > 0 && (
						<div className="mx-4 flex items-center justify-between gap-2">
							<button
								type="button"
								onClick={() => share()}
								disabled={busy || !team}
								className="shrink-0 flex items-center gap-2 justify-center bg-indigo-400 transition-colors duration-200 w-full h-8 text-xs text-indigo-100 hover:bg-indigo-400/70"
							>
								{sharing ? (
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
						<TeamSwitcher
							teams={teamSettings.teams}
							selectedId={team?.id ?? null}
							onSelect={selectTeam}
							onManage={() => setSettingsOpen(true)}
							onRetry={() => void teamSettings.refresh()}
							loading={teamSettings.loading}
							error={teamSettings.error}
							disabled={busy || teamSettings.busy}
						/>
						<MenuItem disabled={busy || !team} onClick={selectFiles} aria-keyshortcuts="Control+O">
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
					<Separator />
				</div>

				<h2 className="section-title truncate">Recentes</h2>

				<RecentFiles
					files={files}
					now={now}
					loading={loading}
					error={listingError}
					hasMore={Boolean(nextCursor)}
					onLoadMore={loadMore}
					onRetry={retry}
					listRef={filesList}
					onQr={(file, trigger) => {
						qrTrigger.current = trigger
						savedScroll.current = filesList.current?.scrollTop ?? 0
						setQrFile(file)
					}}
					onDownload={download}
					onCopy={copyLink}
					copyingId={copyingId}
					downloadingId={downloadingId}
				/>
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
		</>
	)
}
