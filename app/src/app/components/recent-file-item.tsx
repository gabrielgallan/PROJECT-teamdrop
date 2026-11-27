import { formatDistanceToNowStrict } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
	File,
	FileArchive,
	FileCode,
	FileJson,
	FileSpreadsheet,
	FileText,
	Film,
	Image,
	Loader2,
	type LucideIcon,
	Music,
} from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useNavigate } from 'react-router'
import { isDesktop } from '../../desktop/app.commands'
import { useAuth } from '../../hooks/use-auth'
import { useFileActions } from '../../hooks/use-file-actions'
import { errorMessage } from '../../lib/api-error'
import type { TeamFile } from '../../types/file'
import { Avatar } from './avatar'
import { FileActionsMenu } from './file-actions-menu'
import { Toast } from './toast'

const icons: Record<string, LucideIcon> = {
	png: Image,
	jpg: Image,
	jpeg: Image,
	gif: Image,
	webp: Image,
	svg: Image,
	pdf: FileText,
	json: FileJson,
	js: FileCode,
	ts: FileCode,
	tsx: FileCode,
	html: FileCode,
	css: FileCode,
	csv: FileSpreadsheet,
	xls: FileSpreadsheet,
	xlsx: FileSpreadsheet,
	zip: FileArchive,
	rar: FileArchive,
	'7z': FileArchive,
	mp4: Film,
	mov: Film,
	webm: Film,
	mp3: Music,
	wav: Music,
}

interface RecentFileItemProps {
	file: TeamFile
	arriving?: boolean
	animateLayout?: boolean
	arrivalDelay?: number
}

export function RecentFileItem({
	file,
	arriving = false,
	animateLayout = false,
	arrivalDelay = 0,
}: RecentFileItemProps) {
	const reducedMotion = useReducedMotion()
	const { canQuery } = useAuth()
	const { preview, copy, download } = useFileActions()
	const navigate = useNavigate()
	const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
	const Icon = icons[extension] ?? (file.kind === 'image' ? Image : File)
	const error = errorMessage(preview.error || copy.error || download.error)
	return (
		<m.li
			data-file-id={file.id}
			layout={!reducedMotion && animateLayout ? 'position' : false}
			initial={arriving && !reducedMotion ? { opacity: 0, y: -8 } : false}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				duration: reducedMotion ? 0 : 0.2,
				delay: arrivalDelay,
				layout: { duration: 0.2, delay: 0 },
			}}
			className={`list-row group flex-wrap transition-colors hover:bg-white/4 ${arriving ? 'file-arrival-highlight' : ''}`}
		>
			<button
				type="button"
				onClick={() => preview.mutate({ fileId: file.id })}
				disabled={!canQuery || preview.isPending}
				aria-label={`Abrir ${file.name} no navegador`}
				aria-busy={preview.isPending}
				title={`Abrir ${file.name} no navegador (${file.size})`}
				className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:ring-2 focus-visible:ring-indigo-300"
			>
				<span className="item-icon text-white/70">
					{preview.isPending ? (
						<Loader2 className="animate-spin" aria-hidden="true" />
					) : (
						<Icon size={18} aria-hidden="true" />
					)}
				</span>
				<span className="min-w-0 flex-1">
					<span className="block truncate text-ui font-medium text-white/90">
						{file.name}
					</span>
					<span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-white/50">
						<time className="shrink-0 tabular-nums flex gap-1">
							{formatDistanceToNowStrict(file.createdAt, {
								locale: ptBR,
								addSuffix: true,
							})}

							<span>por</span>
						</time>
						<Avatar
							member={file.member}
							size="small"
							className={`size-4 ${file.member.color}`}
						/>
					</span>
				</span>
			</button>
			<FileActionsMenu
				fileId={file.id}
				fileName={file.name}
				disabled={!canQuery}
				copying={copy.isPending}
				downloading={download.isPending}
				onDownload={() => download.mutate(file)}
				onCopy={() => copy.mutate({ fileId: file.id })}
				onQrCode={() =>
					void navigate(
						`/teams/${encodeURIComponent(file.teamId)}/files/${encodeURIComponent(file.id)}/qr`,
						{ state: { fileName: file.name } },
					)
				}
			/>
			{error && (
				<p role="alert" className="w-full px-2 text-xs text-red-300">
					{error}
				</p>
			)}
			{copy.isSuccess && (
				<Toast
					key={`copy-${copy.submittedAt}`}
					message="Link copiado · válido por 5 minutos"
				/>
			)}
			{download.isSuccess && download.data && (
				<Toast
					key={`download-${download.submittedAt}`}
					message={isDesktop() ? 'Arquivo salvo' : 'Download solicitado'}
				/>
			)}
		</m.li>
	)
}
