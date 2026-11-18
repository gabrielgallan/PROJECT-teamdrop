import type { ComponentProps } from 'react'
import { useState } from 'react'
import type { Member } from '../types/team'

interface AvatarProps extends ComponentProps<'img'> {
	member: Member
	className?: string
}

export function Avatar({
	member,
	className = 'size-8',
	src = member.avatarUrl,
	alt = member.name,
	onError,
	...props
}: AvatarProps) {
	const [failedSrc, setFailedSrc] = useState<string>()
	const hasImage = Boolean(src && src !== failedSrc)

	return (
		<span
			className={`inline-grid aspect-square shrink-0 place-items-center overflow-hidden rounded-xl text-[10px] font-medium ${className}`}
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
