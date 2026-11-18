interface ProgressProps {
	value: number
	label?: string
	className?: string
}

export function Progress({
	value,
	label = 'Compartilhando arquivos',
	className = '',
}: ProgressProps) {
	const percentage = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0

	return (
		<div
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(percentage)}
			className={`h-1.5 overflow-hidden rounded-full bg-white/10 ${className}`}
		>
			<div
				className="h-full origin-left rounded-full bg-indigo-400 transition-transform duration-100 ease-linear motion-reduce:transition-none"
				style={{ transform: `scaleX(${percentage / 100})` }}
			/>
		</div>
	)
}
