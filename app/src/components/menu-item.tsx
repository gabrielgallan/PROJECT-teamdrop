import type { ComponentProps, ReactNode } from 'react'

interface MenuItemProps extends ComponentProps<'button'> {
	children: ReactNode
	variant?: 'default' | 'danger'
}

export function MenuItem({
	children,
	className = '',
	variant = 'default',
	...props
}: MenuItemProps) {
	return (
		<button
			{...props}
			type="button"
			className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-ui transition-colors duration-60 focus-visible:ring-2 focus-visible:ring-indigo-300 [&>svg]:size-4 [&>svg]:shrink-0 enabled:hover:*:text-white ${variant === 'danger' ? 'enabled:hover:bg-rose-400' : 'enabled:hover:bg-indigo-400'} ${className}`}
		>
			{children}
		</button>
	)
}
