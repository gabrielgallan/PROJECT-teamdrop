import type { ComponentProps } from 'react'

export function Separator({ className = '', ...props }: ComponentProps<'hr'>) {
	return (
		<hr className={`mx-4 border-t border-white/10 ${className}`} {...props} />
	)
}
