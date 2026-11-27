'use client'

import type { Variants } from 'motion/react'
import { useAnimation } from 'motion/react'
import * as m from 'motion/react-m'
import type { HTMLAttributes } from 'react'
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
} from 'react'

import { cn } from '../../../lib/utils'

export interface BoxIconHandle {
	startAnimation: () => void
	stopAnimation: () => void
}

interface BoxIconProps extends HTMLAttributes<HTMLDivElement> {
	size?: number
	animateOnMount?: boolean
}

const PATH_VARIANTS: Variants = {
	normal: {
		opacity: 1,
		pathLength: 1,
		transition: {
			duration: 0.3,
			opacity: { duration: 0.1 },
		},
	},
	animate: {
		opacity: [0, 1],
		pathLength: [0, 1],
		transition: {
			duration: 0.4,
			opacity: { duration: 0.1 },
		},
	},
}

const BoxIcon = forwardRef<BoxIconHandle, BoxIconProps>(
	(
		{
			onMouseEnter,
			onMouseLeave,
			className,
			size = 28,
			animateOnMount = false,
			...props
		},
		ref,
	) => {
		const controls = useAnimation()
		const isControlledRef = useRef(false)

		useEffect(() => {
			if (animateOnMount) void controls.start('animate')
		}, [animateOnMount, controls])

		useImperativeHandle(ref, () => {
			isControlledRef.current = true
			return {
				startAnimation: () => controls.start('animate'),
				stopAnimation: () => controls.start('normal'),
			}
		})

		const handleMouseEnter = useCallback(
			(e: React.MouseEvent<HTMLDivElement>) => {
				if (isControlledRef.current || animateOnMount) {
					onMouseEnter?.(e)
				} else {
					controls.start('animate')
				}
			},
			[controls, onMouseEnter, animateOnMount],
		)

		const handleMouseLeave = useCallback(
			(e: React.MouseEvent<HTMLDivElement>) => {
				if (isControlledRef.current || animateOnMount) {
					onMouseLeave?.(e)
				} else {
					controls.start('normal')
				}
			},
			[controls, onMouseLeave, animateOnMount],
		)

		return (
			// biome-ignore lint/a11y/noStaticElementInteractions: Hover only animates the decorative icon.
			<div
				className={cn(className)}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				{...props}
			>
				<svg
					aria-hidden="true"
					fill="none"
					height={size}
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="2"
					viewBox="0 0 24 24"
					width={size}
					xmlns="http://www.w3.org/2000/svg"
				>
					<m.path
						animate={controls}
						d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
						initial="normal"
						variants={PATH_VARIANTS}
					/>
					<m.path
						animate={controls}
						d="m3.3 7 8.7 5 8.7-5"
						initial="normal"
						variants={PATH_VARIANTS}
					/>
					<m.path
						animate={controls}
						d="M12 22V12"
						initial="normal"
						variants={PATH_VARIANTS}
					/>
				</svg>
			</div>
		)
	},
)

BoxIcon.displayName = 'BoxIcon'

export { BoxIcon }
