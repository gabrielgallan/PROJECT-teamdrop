import { ArrowLeft } from 'lucide-react'
import type { Ref } from 'react'

interface ScreenHeaderProps {
	title: string
	backLabel: string
	onBack: () => void
	backRef?: Ref<HTMLButtonElement>
	disabled?: boolean
}

export function ScreenHeader({ title, backLabel, onBack, backRef, disabled }: ScreenHeaderProps) {
	return (
		<div className="m-4 flex min-w-0 shrink-0 items-center gap-2">
			<button
				ref={backRef}
				type="button"
				onClick={onBack}
				disabled={disabled}
				aria-label={backLabel}
				className="icon-button text-white/70 hover:bg-white/5 hover:text-white focus-visible:bg-white/10"
			>
				<ArrowLeft aria-hidden="true" />
			</button>
			<h1 className="min-w-0 truncate text-sm font-medium" title={title}>{title}</h1>
		</div>
	)
}
