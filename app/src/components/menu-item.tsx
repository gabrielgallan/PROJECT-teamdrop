import type { ComponentProps, ReactNode } from 'react'

interface MenuItemProps extends ComponentProps<'button'> {
	children: ReactNode
}

export function MenuItem({ children, className = '', ...props }: MenuItemProps) {
	return (
		<button
			{...props}
			type="button"
			className={`flex w-full items-center gap-2 rounded-md py-1.5 px-2 enabled:hover:bg-indigo-400 enabled:hover:*:text-white ${className}`}
		>
			{children}
		</button>
	)
}
