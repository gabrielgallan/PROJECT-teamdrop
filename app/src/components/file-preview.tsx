import { ArrowLeft, Copy, Download, FileText } from 'lucide-react'
import type { SharedFile } from '../types/team'
import { Avatar } from './avatar'

interface FilePreviewProps {
	file: SharedFile
	onBack: () => void
	onCopy: (file: SharedFile) => void
	onDownload: (file: SharedFile) => void
	onShare?: () => void
	sharing?: boolean
}

export function FilePreview({
	file,
	onBack,
	onCopy,
	onDownload,
	onShare,
	sharing,
}: FilePreviewProps) {
	const expired = file.expiresAt <= Date.now()
	return (
		<section className="flex min-h-0 flex-1 flex-col p-4">
			<button
				type="button"
				disabled={sharing}
				onClick={onBack}
				className="mb-4 flex min-h-8 items-center gap-2 self-start text-ui text-white/70 hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-300"
			>
				<ArrowLeft size={16} />
				{onShare ? 'Descartar captura' : 'Voltar aos arquivos'}
			</button>
			<h2 className="break-words font-medium">{file.name}</h2>
			<div className="mb-4 mt-2 flex items-center gap-2 text-xs text-white/60">
				<Avatar member={file.member} />
				{file.member.name}
				<span className="ml-auto">{file.size}</span>
			</div>
			<div className="flex min-h-0 flex-1 mb-4 items-center justify-center overflow-auto rounded-md bg-black/20 p-3">
				{file.kind === 'image' ? (
					<img src={file.url} alt={file.name} className="max-h-full max-w-full object-contain" />
				) : file.text ? (
					<pre className="w-full whitespace-pre-wrap break-words text-xs leading-relaxed text-white/75">
						{file.text}
					</pre>
				) : (
					<div className="text-center text-white/60">
						<FileText size={40} className="mx-auto mb-3" />
						<p className="text-xs">Prévia indisponível para este formato.</p>
					</div>
				)}
			</div>
			{onShare ? (
				<button
					type="button"
					onClick={onShare}
					disabled={sharing}
					className="bg-indigo-400/20 px-3 py-2 text-indigo-100 hover:bg-indigo-400/30"
				>
					{sharing ? 'Compartilhando…' : 'Compartilhar captura'}
				</button>
			) : (
				<div className="grid grid-cols-2 gap-2">
					<button
						type="button"
						disabled={expired}
						onClick={() => onCopy(file)}
						className="flex items-center justify-center gap-2 bg-white/5 px-3 py-2 text-ui hover:bg-white/10"
					>
						<Copy size={16} />
						Copiar link
					</button>
					<button
						type="button"
						disabled={expired}
						onClick={() => onDownload(file)}
						className="flex items-center justify-center gap-2 bg-white/5 px-3 py-2 text-ui hover:bg-white/10"
					>
						<Download size={16} />
						Baixar
					</button>
				</div>
			)}
		</section>
	)
}
