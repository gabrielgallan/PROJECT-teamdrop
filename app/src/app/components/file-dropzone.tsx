import { X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useRef } from 'react'
import type { DropzoneState } from 'react-dropzone'
import {
	CloudUploadIcon,
	type CloudUploadIconHandle,
} from './icons/cloud-upload'
import { FileCheck2Icon, type FileCheck2IconHandle } from './icons/file-check'
import { Progress } from './progress'

interface FileDropzoneProps {
	dropzone: Pick<
		DropzoneState,
		'getRootProps' | 'getInputProps' | 'isDragActive'
	>
	files: { name: string }[]
	error: string
	onSelect: () => void
	onClear: () => void
	disabled?: boolean
	progress?: number
	progressLabel?: string
	status?: string
	success?: string
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
	status,
	success,
}: FileDropzoneProps) {
	const { getRootProps, getInputProps, isDragActive } = dropzone
	const uploadIcon = useRef<CloudUploadIconHandle>(null)
	const successIcon = useRef<FileCheck2IconHandle>(null)
	const firstFile = files[0]
	const border = isDragActive ? 'border-white/20 bg-white/5' : 'border-white/10'

	return (
		<section
			{...getRootProps({
				'aria-label': 'Seleção de arquivos',
				onMouseEnter: () => {
					if (disabled) return
					uploadIcon.current?.startAnimation()
					successIcon.current?.startAnimation()
				},
				onMouseLeave: () => {
					uploadIcon.current?.stopAnimation()
					successIcon.current?.stopAnimation()
				},
				className: `relative mx-4 flex h-38 flex-col rounded-md border-2 border-dashed ${border}`,
			})}
		>
			<input {...getInputProps()} />
			<AnimatePresence initial={false} mode="wait">
				{status ? (
					<m.div
						key="uploading"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.12 }}
						className="flex flex-1 flex-col items-center justify-center gap-3 px-8"
					>
						<p role="status" className="text-xs text-white/75">
							{status}
						</p>
						<Progress label={status} className="w-full" />
					</m.div>
				) : success ? (
					<m.div
						key="success"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.12 }}
						role="status"
						className="flex flex-1 items-center justify-center"
					>
						<span className="sr-only">{success}</span>
						<button
							type="button"
							onClick={onSelect}
							disabled={disabled}
							aria-label="Selecionar arquivos"
							className="grid size-12 place-items-center hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-indigo-300"
						>
							<FileCheck2Icon
								ref={successIcon}
								size={32}
								className="text-indigo-300"
								aria-hidden="true"
							/>
						</button>
					</m.div>
				) : progress !== undefined ? (
					<m.div
						key="progress"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.12 }}
						className="flex flex-1 flex-col items-center justify-center gap-3 px-8"
					>
						<span className="text-xs text-white/65">
							{progressLabel}… {Math.round(progress)}%
						</span>
						<Progress
							value={progress}
							label={progressLabel}
							className="w-full"
						/>
					</m.div>
				) : (
					<m.div
						key="selection"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.12 }}
						className="flex min-h-0 flex-1 items-center justify-center gap-1 px-3"
					>
						<button
							type="button"
							disabled={disabled}
							onClick={onSelect}
							aria-label="Selecionar arquivos"
							className="flex min-w-0 items-center gap-2 text-white/90 before:absolute before:inset-0 before:rounded-md hover:before:bg-white/5"
						>
							<CloudUploadIcon
								ref={uploadIcon}
								size={16}
								aria-hidden="true"
								className="shrink-0"
							/>
							{files.length > 1 ? (
								<span>{files.length} arquivos carregados</span>
							) : firstFile ? (
								<span className="truncate" title={firstFile.name}>
									{firstFile.name}
								</span>
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
					</m.div>
				)}
			</AnimatePresence>
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
