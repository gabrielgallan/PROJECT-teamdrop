import type { LucideIcon } from 'lucide-react'
import {
	File,
	FileArchive,
	FileCode,
	FileJson,
	FileSpreadsheet,
	FileText,
	Film,
	Image,
	Inbox,
	Link,
	Music,
} from 'lucide-react'
import type { SharedFile } from '../types/team'
import { Avatar } from './avatar'

const fileIcons: Record<string, LucideIcon> = {
	png: Image,
	jpg: Image,
	jpeg: Image,
	gif: Image,
	webp: Image,
	svg: Image,
	pdf: FileText,
	txt: FileText,
	md: FileText,
	doc: FileText,
	docx: FileText,
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

export function relativeTime(date: number, now: number) {
	const minutes = Math.max(0, Math.floor((now - date) / 60000))
	if (minutes < 1) return 'agora'
	if (minutes < 60) return `há ${minutes} min`
	if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`
	return `há ${Math.floor(minutes / 1440)} d`
}

export function RecentFiles({
	files,
	now,
	onPreview,
	onCopy,
}: {
	files: SharedFile[]
	now: number
	onPreview: (file: SharedFile) => void
	onCopy: (file: SharedFile) => void
}) {
	return (
		<section
			aria-label="Arquivos recentes da equipe"
			className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
		>
			{files.length === 0 ? (
				<div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-white/60">
					<Inbox size={24} />
					<p>Nenhum arquivo por aqui.</p>
					<p className="text-xs">Compartilhe o primeiro com a equipe.</p>
				</div>
			) : (
				<ul>
					{files.map((file) => (
						<SharedFileItem
							key={file.id}
							file={file}
							now={now}
							onPreview={onPreview}
							onCopy={onCopy}
						/>
					))}
				</ul>
			)}
		</section>
	)
}

function SharedFileItem({
	file,
	now,
	onPreview,
	onCopy,
}: {
	file: SharedFile
	now: number
	onPreview: (file: SharedFile) => void
	onCopy: (file: SharedFile) => void
}) {
	const expired = file.expiresAt <= now
	const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
	const Icon = fileIcons[extension] ?? (file.kind === 'image' ? Image : File)
	return (
		<li className="group *:transition-colors *:duration-100 flex items-center gap-1 rounded-xl px-2 hover:bg-white/5">
			<button
				type="button"
				disabled={expired}
				onClick={() => onPreview(file)}
				className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left"
			>
				<Avatar member={file.member} className="size-9" />
				<span className="min-w-0 flex-1">
					<span className="flex items-baseline gap-2">
						{file.isNew && !expired && (
							<span
								title="Novo arquivo"
								className="size-1.5 shrink-0 self-center rounded-full bg-indigo-400"
							>
								<span className="sr-only">Novo arquivo</span>
							</span>
						)}
						<span className={`truncate text-[13px] ${expired ? 'text-white/40' : 'text-white/90'}`}>
							{file.member.name}
						</span>
						<time
							className="shrink-0 text-[11px] text-white/45"
							dateTime={new Date(file.createdAt).toISOString()}
						>
							{relativeTime(file.createdAt, now)}
						</time>
					</span>
					<span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-white/60">
						<Icon size={12} className="shrink-0" aria-hidden="true" />
						<span className="truncate" title={file.name}>
							{file.name}
						</span>
					</span>
				</span>
			</button>
			{expired ? (
				<span className="text-[10px] text-white/45">Expirado</span>
			) : (
				<button
					type="button"
					onClick={() => onCopy(file)}
					aria-label={`Copiar link de ${file.name}`}
					title="Copiar link"
					className="grid rounded-xl size-8 shrink-0 place-items-center text-white/55 hover:bg-white/10 hover:text-white"
				>
					<Link size={14} />
				</button>
			)}
		</li>
	)
}
