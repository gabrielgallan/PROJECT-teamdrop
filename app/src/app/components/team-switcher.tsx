import { Box, Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/use-auth'
import { userTeamsQuery } from '../../api/teams/queries'
import { useSelectedTeam, useTeamUploadQueue } from '../../hooks/use-workspace'
import { errorMessage } from '../../lib/api-error'
import { MenuItem } from './menu-item'
import { Skeleton } from './skeleton'

export function TeamSwitcher() {
	const { user, canQuery } = useAuth()
	const listing = useQuery({ ...userTeamsQuery(user.id), enabled: canQuery })
	const { team, selectTeam: onSelect } = useSelectedTeam()
	const { sharing } = useTeamUploadQueue()
	const navigate = useNavigate()
	const teams = listing.data?.teams ?? []
	const selectedId = team?.id ?? null
	const loading = listing.isPending
	const error = errorMessage(listing.error)
	const disabled = sharing || !canQuery
	const onManage = () => void navigate('/settings')
	const onRetry = () => void listing.refetch()
	const id = useId()
	const trigger = useRef<HTMLButtonElement>(null)
	const popup = useRef<HTMLDivElement>(null)
	const search = useRef<HTMLInputElement>(null)
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const [position, setPosition] = useState({ top: 0, left: 8, width: 0, maxHeight: 240 })
	const selected = teams.find((team) => team.id === selectedId)
	const searchable = teams.length > 5
	const filtered = teams.filter((team) => team.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
	const single = teams.length === 1 && !error
	const canOpen = teams.length > 1 || Boolean(error)

	function close() {
		popup.current?.hidePopover()
		trigger.current?.focus()
	}

	useEffect(() => {
		if (!open) return
		function reposition() {
			const bounds = trigger.current?.getBoundingClientRect()
			if (!bounds) return
			const below = window.innerHeight - bounds.bottom - 12
			const above = bounds.top - 12
			const maxHeight = Math.min(240, Math.max(below, above))
			const width = Math.min(bounds.width, window.innerWidth - 16)
			setPosition({
				top: below >= maxHeight ? bounds.bottom + 4 : Math.max(8, bounds.top - maxHeight - 4),
				left: Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8)),
				width,
				maxHeight,
			})
		}
		reposition()
		window.addEventListener('resize', reposition)
		window.addEventListener('scroll', reposition, true)
		return () => {
			window.removeEventListener('resize', reposition)
			window.removeEventListener('scroll', reposition, true)
		}
	}, [open])

	useEffect(() => {
		if (disabled || loading || single || teams.length === 0) popup.current?.hidePopover()
	}, [disabled, loading, single, teams.length])

	return (
		<>
			<MenuItem
				ref={trigger}
				disabled={disabled || loading || single}
				className={loading || (single && !disabled) ? 'disabled:opacity-100' : ''}
				aria-busy={loading}
				aria-label={selected ? `Time atual: ${selected.name}` : loading ? 'Carregando times' : 'Selecionar ou criar um time'}
				aria-haspopup={canOpen ? 'dialog' : undefined}
				aria-expanded={canOpen ? open : undefined}
				aria-controls={id}
				onClick={() => {
					if (teams.length === 0 && !error) { onManage(); return }
					if (open) close()
					else {
						setQuery('')
						popup.current?.showPopover()
					}
				}}
			>
				{loading ? <Skeleton className="size-4 shrink-0" /> : <Box aria-hidden="true" />}
				<span className="min-w-0 flex-1 truncate text-left" title={selected?.name}>
					{loading ? <Skeleton className="h-3 w-28" /> : selected?.name ?? (error ? 'Recarregar times' : 'Selecionar ou criar um time')}
				</span>
				{!loading && !single && teams.length > 0 && <ChevronDown aria-hidden="true" />}
			</MenuItem>
			<div
				ref={popup}
				id={id}
				popover="auto"
				role="dialog"
				aria-label="Trocar time"
				style={position}
				className="team-switcher-popover fixed inset-auto m-0 flex-col overflow-hidden rounded-md border border-white/10 bg-zinc-800 p-2 text-white/90"
				onToggle={(event) => {
					const visible = event.newState === 'open'
					setOpen(visible)
					if (visible) {
						if (searchable) search.current?.focus()
						else (popup.current?.querySelector('[aria-current="true"]') as HTMLElement | null
							?? popup.current?.querySelector('button'))?.focus()
					}
				}}
				onKeyDown={(event) => {
					event.stopPropagation()
					if (event.key === 'Escape') { event.preventDefault(); close(); return }
					if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
					if (event.target === search.current && event.key !== 'ArrowDown') return
					const items = Array.from(popup.current?.querySelectorAll<HTMLButtonElement>('[data-team-option]') ?? [])
					if (!items.length) return
					event.preventDefault()
					const index = items.indexOf(document.activeElement as HTMLButtonElement)
					const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
						: (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
					items[next].focus()
				}}
			>
				{searchable && (
					<div className="mb-2 flex shrink-0 items-center gap-2 rounded-md bg-white/5 px-2 py-1.5">
						<Search className="size-4 shrink-0 text-white/60" aria-hidden="true" />
						<input ref={search} aria-label="Buscar time" value={query} onChange={(event) => setQuery(event.target.value)}
							placeholder="Buscar time…" className="min-w-0 flex-1 bg-transparent text-ui placeholder:text-white/60 focus-visible:ring-2 focus-visible:ring-indigo-300" />
					</div>
				)}
				{error && <div role="alert" className="mb-2 px-2 text-xs text-red-300">
					<p>{error}</p><button type="button" onClick={onRetry} className="mt-1 underline">Tentar novamente</button>
				</div>}
				<ul aria-label="Seus times" className="min-h-0 space-y-1 overflow-y-auto">
					{filtered.map((team) => <li key={team.id}>
						<MenuItem data-team-option aria-current={team.id === selectedId ? 'true' : undefined}
							onClick={() => { onSelect(team.id); close() }}>
							<Box aria-hidden="true" />
							<span className="min-w-0 flex-1 truncate text-left" title={team.name}>{team.name}</span>
							{team.id === selectedId && <Check className="text-indigo-400" aria-hidden="true" />}
						</MenuItem>
					</li>)}
				</ul>
				{filtered.length === 0 && !error && <p role="status" className="px-2 py-3 text-xs text-white/70">Nenhum time encontrado.</p>}
			</div>
		</>
	)
}
