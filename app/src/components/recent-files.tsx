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
	Loader2,
} from 'lucide-react'
import type { TeamFile } from '../types/file'
import { Avatar } from './avatar'

const fileIcons: Record<string, LucideIcon> = {
	png: Image,
	jpg: Image,
	jpeg: Image,
	gif: Image,
	webp: Image,
	svg: Image,
	pdf: FileText,
	txt: File,
	md: File,
	doc: File,
	docx: File,
	rtf: File,
	log: File,
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

interface RecentFilesProps {
	files: TeamFile[]
	now: number
	loading: boolean
	error: string
	hasMore: boolean
	onLoadMore: () => void
	onRetry: () => void
	onDownload: (file: TeamFile) => void
	onCopy: (file: TeamFile) => void
	copyingId: string | null
	downloadingId: string | null
}

export function RecentFiles({ files, now, loading, error, hasMore, onLoadMore, onRetry, onDownload, onCopy, copyingId, downloadingId }: RecentFilesProps) {
	return (
		<section aria-label="Arquivos recentes da equipe" aria-busy={loading} className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
			{files.length > 0 && <ul className="item-list">
				{files.map((file) => {
					const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
					const Icon = fileIcons[extension] ?? (file.kind === 'image' ? Image : File)
					return <li key={file.id} className="list-row group transition-colors hover:bg-white/4">
						<button type="button" onClick={() => onDownload(file)} disabled={Boolean(downloadingId)}
							aria-label={`Baixar ${file.name}`} aria-busy={downloadingId === file.id}
							title={`Baixar ${file.name} (${file.size})`}
							className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:ring-2 focus-visible:ring-indigo-300">
							<span className="item-icon text-white/70">
								{downloadingId === file.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Icon size={18} aria-hidden="true" />}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-ui font-medium text-white/90">{file.name}</span>
								<span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-white/50">
									<Avatar member={file.member} size="small" className={`size-4 ${file.member.color}`} />
									<span className="min-w-0 truncate" title={file.member.name}>{file.member.name}</span>
									<time className="shrink-0 tabular-nums" dateTime={new Date(file.createdAt).toISOString()}>{relativeTime(file.createdAt, now)}</time>
								</span>
							</span>
						</button>
						<button type="button" onClick={() => onCopy(file)} disabled={Boolean(copyingId)}
							aria-label={`Gerar e copiar link de ${file.name}`} title="Gerar e copiar link · válido por 5 minutos"
							className="icon-button text-white/45 transition-colors hover:bg-white/10 hover:text-white">
							{copyingId === file.id ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Link size={16} aria-hidden="true" />}
						</button>
					</li>
				})}
			</ul>}
			{loading && <p role="status" className="flex items-center justify-center gap-2 py-4 text-xs text-white/70"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Carregando arquivos…</p>}
			{error && <div role="alert" className="space-y-2 px-2 py-3 text-xs text-red-300">
				<p>{error}</p><button type="button" onClick={onRetry} disabled={loading} className="underline focus-visible:ring-2 focus-visible:ring-indigo-300">Tentar novamente</button>
			</div>}
			{!loading && !error && files.length === 0 && <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-white/60">
				<Inbox size={24} aria-hidden="true" /><p className="text-xs">Compartilhe com a equipe</p>
			</div>}
			{hasMore && !error && <button type="button" onClick={onLoadMore} disabled={loading}
				className="my-2 w-full rounded-md bg-white/5 px-3 py-2 text-xs hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-300">{loading ? 'Carregando…' : 'Carregar mais'}</button>}
		</section>
	)
}
