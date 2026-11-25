import { useInfiniteQuery } from '@tanstack/react-query'
import { Inbox } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { teamFilesQuery } from '../../api/files/queries'
import { useAuth } from '../../hooks/use-auth'
import { useNow } from '../../hooks/use-now'
import { useSelectedTeam, useWorkspaceScroll } from '../../hooks/use-workspace'
import { errorMessage } from '../../lib/api-error'
import { fileView } from '../utils/presentation'
import { RecentFileItem } from './recent-file-item'
import { ListSkeleton } from './skeleton'

export function RecentFiles() {
	const { team, teamsLoading } = useSelectedTeam()
	if (teamsLoading)
		return (
			<section
				aria-label="Arquivos recentes da equipe"
				aria-busy="true"
				className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
			>
				<ListSkeleton variant="file" />
			</section>
		)
	return <TeamRecentFiles key={team?.id ?? 'empty'} teamId={team?.id ?? ''} />
}

function TeamRecentFiles({ teamId }: { teamId: string }) {
	const { user, canQuery } = useAuth()
	const query = useInfiniteQuery({
		...teamFilesQuery(user.id, teamId),
		enabled: canQuery && Boolean(teamId),
	})
	useNow(30_000)
	const scroll = useWorkspaceScroll()
	const list = useRef<HTMLElement>(null)
	const files =
		query.data?.pages.flatMap((page) =>
			page.files.map((file) => fileView(file, teamId)),
		) ?? []
	const loading = Boolean(teamId) && query.isFetching
	const initialLoading = Boolean(teamId) && canQuery && query.isPending
	const error = errorMessage(query.error)
	useLayoutEffect(() => {
		if (list.current) list.current.scrollTop = scroll.get(teamId) ?? 0
	}, [teamId, scroll])
	return (
		<section
			ref={list}
			aria-label="Arquivos recentes da equipe"
			aria-busy={loading}
			onScroll={(event) => scroll.set(teamId, event.currentTarget.scrollTop)}
			className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
		>
			{files.length > 0 && (
				<ul className="item-list">
					{files.map((file) => (
						<RecentFileItem key={file.id} file={file} />
					))}
				</ul>
			)}
			{initialLoading && <ListSkeleton variant="file" />}
			{query.isFetchingNextPage && (
				<ListSkeleton
					variant="file"
					count={2}
					label="Carregando mais arquivos…"
				/>
			)}
			{error && (
				<div role="alert" className="space-y-2 px-2 py-3 text-xs text-red-300">
					<p>{error}</p>
					<button
						type="button"
						disabled={loading || !canQuery}
						className="underline focus-visible:ring-2 focus-visible:ring-indigo-300"
						onClick={() =>
							void (query.isFetchNextPageError
								? query.fetchNextPage()
								: query.refetch())
						}
					>
						Tentar novamente
					</button>
				</div>
			)}
			{!initialLoading && !error && files.length === 0 && (
				<div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-white/60">
					<Inbox size={24} aria-hidden="true" />
					<p className="text-xs">Compartilhe com a equipe</p>
				</div>
			)}
			{query.hasNextPage && !error && (
				<button
					type="button"
					disabled={loading || !canQuery}
					onClick={() => {
						if (!query.isFetching) void query.fetchNextPage()
					}}
					className="my-2 w-full rounded-md bg-white/5 px-3 py-2 text-xs hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-300"
				>
					{loading ? 'Carregando…' : 'Carregar mais'}
				</button>
			)}
		</section>
	)
}
