import type { ComponentProps } from 'react'

export function Skeleton({ className = '', ...props }: ComponentProps<'span'>) {
	return <span {...props} aria-hidden="true" className={`skeleton ${className}`} />
}

type ListVariant = 'file' | 'member' | 'team'
const listLabels: Record<ListVariant, string> = {
	file: 'Carregando arquivos…',
	member: 'Carregando membros…',
	team: 'Carregando times…',
}

export function ListSkeleton({ variant, count = 3, label = listLabels[variant] }: {
	variant: ListVariant
	count?: number
	label?: string
}) {
	return <div role="status">
		<span className="sr-only">{label}</span>
		<ul aria-hidden="true" className="item-list">
			{Array.from({ length: count }, (_, index) => <li key={index} className="list-row">
				<Skeleton className={`size-9 shrink-0 ${variant === 'member' ? 'rounded-full' : 'rounded-xl'}`} />
				<div className="min-w-0 flex-1 space-y-2">
					<Skeleton className={`h-3.5 ${index % 2 === 0 ? 'w-3/5' : 'w-2/5'}`} />
					{variant === 'file' && <Skeleton className="h-2.5 w-1/3" />}
				</div>
				<Skeleton className="size-4 shrink-0" />
				{variant === 'file' && <Skeleton className="size-4 shrink-0" />}
			</li>)}
		</ul>
	</div>
}

export function ProfileSkeleton({ className = '', label = 'Carregando perfil…' }: {
	className?: string
	label?: string
}) {
	return <div role="status" aria-busy="true" className={`flex items-center gap-3 ${className}`}>
		<span className="sr-only">{label}</span>
		<Skeleton className="size-10 shrink-0 rounded-full" />
		<div className="w-40 space-y-2">
			<Skeleton className="h-3.5 w-3/4" />
			<Skeleton className="h-3 w-full" />
		</div>
	</div>
}

// Decorative, deliberately incomplete modules: this never encodes a scannable URL.
const qrModules = Array.from({ length: 21 * 21 }, (_, index) => {
	const x = index % 21
	const y = Math.floor(index / 21)
	const finder = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)
	return { x, y, visible: !finder && (x * 11 + y * 7 + x * y) % 5 < 3 }
}).filter((module) => module.visible)

export function QrCodeSkeleton() {
	return <div role="status" className="flex flex-col items-center gap-4">
		<svg width="200" height="200" viewBox="0 0 25 25" aria-hidden="true" focusable="false" className="max-w-full">
			{[[2, 2], [16, 2], [2, 16]].map(([x, y]) => <g key={`${x}-${y}`} className="skeleton-qr-cell">
				<rect x={x} y={y} width="6" height="6" rx="0.7" fill="none" stroke="currentColor" strokeWidth="0.8" />
				<rect x={x + 1.9} y={y + 1.9} width="2.2" height="2.2" rx="0.3" />
			</g>)}
			{qrModules.map(({ x, y }) => <rect key={`${x}-${y}`} x={x + 2.1} y={y + 2.1}
				width="0.75" height="0.75" rx="0.15" className="skeleton-qr-cell"
				style={{ animationDelay: `${((x + y * 3) % 8) * -180}ms` }} />)}
		</svg>
		<div className="flex flex-col items-center gap-2 text-xs text-white/70">
			<p>Gerando QR Code…</p>
			<Skeleton className="h-3 w-28" />
		</div>
	</div>
}
