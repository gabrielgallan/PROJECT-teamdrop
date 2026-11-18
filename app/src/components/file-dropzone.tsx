import { CloudUpload, X } from 'lucide-react'
import type { DropzoneState } from 'react-dropzone'
import { Progress } from './progress'

interface FileDropzoneProps {
	dropzone: Pick<DropzoneState, 'getRootProps' | 'getInputProps' | 'isDragActive'>
	files: { name: string }[]
	error: string
	onSelect: () => void
	onClear: () => void
	disabled?: boolean
	progress?: number
	progressLabel?: string
}

export function FileDropzone({
	dropzone,
	files,
	error,
	onSelect,
	onClear,
	disabled,
	progress,
	progressLabel = 'Preparando arquivos',
}: FileDropzoneProps) {
	const { getRootProps, getInputProps, isDragActive } = dropzone
	const firstFile = files[0]
	const otherFiles = files.length - 1
	const border = isDragActive ? 'border-white/20 bg-white/5' : 'border-white/10'

	return (
		<section
			{...getRootProps({
				'aria-label': 'Seleção de arquivos',
				className: `relative mx-4 flex h-32 flex-col rounded-md border-2 border-dashed ${border}`,
			})}
		>
			<input {...getInputProps()} />
			{progress !== undefined ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-3 px-8">
					<span className="text-xs text-white/65">
						{progressLabel}… {Math.round(progress)}%
					</span>
					<Progress value={progress} label={progressLabel} className="w-full" />
				</div>
			) : (
				<div className="flex min-h-0 flex-1 items-center justify-center gap-1 px-3">
					<button
						type="button"
						disabled={disabled}
						onClick={onSelect}
						aria-label="Selecionar arquivos"
						className="flex min-w-0 items-center gap-2 text-white/90 before:absolute before:inset-0 before:rounded-md hover:before:bg-white/5"
					>
						<CloudUpload aria-hidden="true" className="size-4 shrink-0 stroke-2" />
						{firstFile ? (
							<>
								<span className="truncate" title={firstFile.name}>
									{firstFile.name}
								</span>
								{otherFiles > 0 && <span className="shrink-0 text-white/70">+{otherFiles}</span>}
							</>
						) : (
							'Arraste arquivos aqui…'
						)}
					</button>
					{firstFile && (
						<button
							type="button"
							disabled={disabled}
							onClick={onClear}
							aria-label="Limpar seleção"
							className="relative z-10 grid size-6 shrink-0 place-items-center text-white/55 hover:bg-white/10 hover:text-white"
						>
							<X aria-hidden="true" className="size-3" />
						</button>
					)}
				</div>
			)}
			{error && (
				<p role="alert" className="px-2 text-center text-xs text-red-300">
					{error}
				</p>
			)}
			<p role="status" className="sr-only">
				{files.length === 1
					? `${firstFile.name} selecionado`
					: `${files.length} arquivos selecionados`}
			</p>
		</section>
	)
}
