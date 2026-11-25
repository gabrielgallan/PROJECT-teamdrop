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
	Link,
	Loader2,
	type LucideIcon,
	Music,
	QrCode,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { isDesktop } from '../../desktop/app.commands'
import { useAuth } from '../../hooks/use-auth'
import { useFileActions } from '../../hooks/use-file-actions'
import { errorMessage } from '../../lib/api-error'
import type { TeamFile } from '../../types/file'
import { Avatar } from './avatar'
import { OperationFeedback } from './operation-feedback'

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
}

export function RecentFileItem({ file }: RecentFileItemProps) {
	const { canQuery } = useAuth()
	const { copy, download } = useFileActions()
	const navigate = useNavigate()
	const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
	const Icon = icons[extension] ?? (file.kind === 'image' ? Image : File)
	const error = errorMessage(copy.error || download.error)
	return (
		<li className="list-row group flex-wrap transition-colors hover:bg-white/4">
			<button
				type="button"
				onClick={() => download.mutate(file)}
				disabled={!canQuery || download.isPending}
				aria-label={`Baixar ${file.name}`}
				aria-busy={download.isPending}
				title={`Baixar ${file.name} (${file.size})`}
				className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:ring-2 focus-visible:ring-indigo-300"
			>
				<span className="item-icon text-white/70">
					{download.isPending ? (
						<Loader2 className="animate-spin" aria-hidden="true" />
					) : (
						<Icon size={18} aria-hidden="true" />
					)}
				</span>
				<span className="min-w-0 flex-1">
					<span className="block truncate text-ui font-medium text-white/90">{file.name}</span>
					<span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-white/50">
						<time className="shrink-0 tabular-nums flex gap-1">
							{formatDistanceToNowStrict(file.createdAt, {
								locale: ptBR,
								addSuffix: true,
							})}

							<p>por</p>
						</time>
						<Avatar member={file.member} size="small" className={`size-4 ${file.member.color}`} />
					</span>
				</span>
			</button>
			<div className="flex shrink-0 items-center gap-1">
				<button
					type="button"
					onClick={() => copy.mutate({ fileId: file.id })}
					disabled={!canQuery || copy.isPending}
					className="icon-button text-white/45 transition-colors hover:bg-white/10 hover:text-white"
				>
					{copy.isPending ? (
						<Loader2 size={16} className="animate-spin" aria-hidden="true" />
					) : (
						<Link size={16} aria-hidden="true" />
					)}
				</button>
				<button
					id={`qr-${file.id}`}
					type="button"
					onClick={() =>
						void navigate(
							`/teams/${encodeURIComponent(file.teamId)}/files/${encodeURIComponent(file.id)}/qr`,
							{ state: { fileName: file.name } },
						)
					}
					aria-label={`Exibir QR Code de ${file.name}`}
					title="Exibir QR Code"
					className="icon-button text-white/45 transition-colors hover:bg-white/10 hover:text-white"
				>
					<QrCode size={16} aria-hidden="true" />
				</button>
			</div>
			{error && (
				<p role="alert" className="w-full px-2 text-xs text-red-300">
					{error}
				</p>
			)}
			{copy.isSuccess && (
				<OperationFeedback
					key={`copy-${copy.submittedAt}`}
					message="Link copiado · válido por 5 minutos"
				/>
			)}
			{download.isSuccess && download.data && (
				<OperationFeedback
					key={`download-${download.submittedAt}`}
					message={isDesktop() ? 'Arquivo salvo' : 'Download solicitado'}
				/>
			)}
		</li>
	)
}
