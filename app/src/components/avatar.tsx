import type { ComponentProps } from 'react'
import { useState } from 'react'
import type { Member } from '../types/team'

interface AvatarProps extends ComponentProps<'img'> {
	member: Member
	className?: string
	size?: 'default' | 'small'
	hasBorder?: boolean
}

export function Avatar({
	member,
	size = 'default',
	className = size === 'small' ? 'size-4' : 'size-8',
	src = member.avatarUrl,
	alt = member.name,
	onError,
	hasBorder = false,
	...props
}: AvatarProps) {
	const [failedSrc, setFailedSrc] = useState<string>()
	const hasImage = Boolean(src && src !== failedSrc)

	return (
		<span
			className={`inline-grid aspect-square shrink-0 place-items-center overflow-hidden rounded-full ${hasBorder && 'border-2 border-transparent outline-2 outline-indigo-300'} font-medium ${size === 'small' ? 'text-[7px]' : 'text-[10px]'} ${className}`}
		>
			{hasImage ? (
				<img
					{...props}
					alt={alt}
					src={src}
					className="size-full object-cover"
					onError={(event) => {
						setFailedSrc(src)
						onError?.(event)
					}}
				/>
			) : (
				<span role="img" aria-label={alt}>
					{member.initials}
				</span>
			)}
		</span>
	)
}
