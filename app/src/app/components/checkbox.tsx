import { Check } from 'lucide-react'
import { type ComponentProps, type ReactNode, useId } from 'react'

interface CheckboxProps
	extends Omit<ComponentProps<'input'>, 'type' | 'children'> {
	label: ReactNode
	description?: string
}

export function Checkbox({
	label,
	description,
	id: providedId,
	className = '',
	...props
}: CheckboxProps) {
	const generatedId = useId()
	const id = providedId ?? generatedId
	return (
		<label
			htmlFor={id}
			className={`flex items-start gap-3 rounded-md p-2 text-left has-disabled:opacity-50 ${className}`}
		>
			<input
				{...props}
				id={id}
				type="checkbox"
				aria-describedby={description ? `${id}-description` : undefined}
				className="peer sr-only"
			/>
			<span
				aria-hidden="true"
				className="mt-0.5 grid size-4 shrink-0 place-items-center rounded border border-white/30 bg-white/5 text-zinc-950 transition-colors duration-120 peer-checked:border-indigo-400 peer-checked:bg-indigo-400 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-200 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-800 [&>svg]:scale-75 [&>svg]:opacity-0 peer-checked:[&>svg]:scale-100 peer-checked:[&>svg]:opacity-100 motion-reduce:transition-none"
			>
				<Check
					size={12}
					strokeWidth={3}
					className="transition-[opacity,transform] duration-120 motion-reduce:transition-none"
				/>
			</span>
			<span className="min-w-0 flex-1">
				<span className="block text-ui font-medium text-white/90">{label}</span>
				{description && (
					<span
						id={`${id}-description`}
						className="mt-1 block text-xs leading-relaxed text-white/65"
					>
						{description}
					</span>
				)}
			</span>
		</label>
	)
}
