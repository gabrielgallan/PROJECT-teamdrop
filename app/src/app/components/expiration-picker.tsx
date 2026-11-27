import {
	WheelPicker,
	type WheelPickerOption,
	WheelPickerWrapper,
} from '@ncdai/react-wheel-picker'
import {
	type Ref,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from 'react'
import '@ncdai/react-wheel-picker/style.css'

const expirationOptions: WheelPickerOption<number>[] = [
	{ value: 900, label: '15 minutos' },
	{ value: 1800, label: '30 minutos' },
	{ value: 3600, label: '1 hora' },
	{ value: 10800, label: '3 horas' },
	{ value: 21600, label: '6 horas' },
	{ value: 43200, label: '12 horas' },
	{ value: 86400, label: '24 horas' },
	{ value: 172800, label: '48 horas' },
	{ value: 259200, label: '72 horas' },
]

export function formatExpiration(seconds: number) {
	if (seconds === 3600) return '1 hora'
	if (seconds % 3600 === 0) return `${seconds / 3600} horas`
	if (seconds % 60 === 0) return `${seconds / 60} minutos`
	return `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}

interface ExpirationPickerProps {
	value: number
	onValueChange: (value: number) => void
	disabled?: boolean
	ref?: Ref<HTMLDivElement>
}

export function ExpirationPicker({
	value,
	onValueChange,
	disabled = false,
	ref,
}: ExpirationPickerProps) {
	const container = useRef<HTMLDivElement>(null)
	// Keep an existing custom API value available while the picker is open.
	const [options] = useState(() =>
		expirationOptions.some((option) => option.value === value)
			? expirationOptions
			: [...expirationOptions, { value, label: formatExpiration(value) }].sort(
					(a, b) => a.value - b.value,
				),
	)

	useImperativeHandle<HTMLDivElement | null, HTMLDivElement | null>(
		ref,
		() =>
			container.current?.querySelector<HTMLDivElement>('[data-rwp]') ?? null,
		[],
	)

	useLayoutEffect(() => {
		// The library does not expose DOM props or a ref on the focusable wheel.
		const wheel = container.current?.querySelector('[data-rwp]')
		if (!wheel) return
		wheel.setAttribute('role', 'spinbutton')
		wheel.setAttribute('aria-label', 'Prazo de retenção de arquivos')
		wheel.setAttribute('aria-valuemin', '900')
		wheel.setAttribute('aria-valuemax', '259200')
		wheel.setAttribute('aria-valuenow', String(value))
		wheel.setAttribute('aria-valuetext', formatExpiration(value))
		wheel.setAttribute('aria-disabled', String(disabled))
	}, [value, disabled])

	return (
		<div
			ref={container}
			inert={disabled}
			className={disabled ? 'opacity-50' : undefined}
		>
			<WheelPickerWrapper className="rounded-lg bg-white/5 px-3">
				<WheelPicker
					options={options}
					value={value}
					onValueChange={(next) => {
						if (!disabled) onValueChange(next)
					}}
					visibleCount={16}
					optionItemHeight={36}
					classNames={{
						optionItem: 'text-white/65',
						highlightWrapper:
							'rounded-md bg-zinc-700 text-indigo-200 data-[rwp-focused]:ring-1 data-[rwp-focused]:ring-inset data-[rwp-focused]:ring-indigo-300',
						highlightItem: 'text-sm font-medium',
					}}
				/>
			</WheelPickerWrapper>
		</div>
	)
}
