import { useInfiniteQuery } from '@tanstack/react-query'
import { ArrowUp, Inbox } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { teamFilesQuery } from '../../api/files/queries'
import { useAuth } from '../../hooks/use-auth'
import { useFileFeed } from '../../hooks/use-file-feed'
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
	const files = [
		...new Map(
			(
				query.data?.pages.flatMap((page) =>
					page.files.map((file) => fileView(file, teamId)),
				) ?? []
			).map((file) => [file.id, file]),
		).values(),
	]
	const feed = useFileFeed({
		userId: user.id,
		teamId,
		ids: files.map((file) => file.id),
		ready: query.isSuccess,
		scroll,
	})
	const loading = Boolean(teamId) && query.isFetching
	const initialLoading = Boolean(teamId) && canQuery && query.isPending
	const error = errorMessage(query.error)
	return (
		<div className="relative min-h-0 flex-1 flex flex-col">
			<m.section
				ref={feed.list}
				layoutScroll
				tabIndex={-1}
				aria-label="Arquivos recentes da equipe"
				aria-busy={loading}
				onScroll={feed.onScroll}
				className="min-h-0 flex-1 overflow-x-clip overflow-y-auto px-2 pb-4 outline-none [overflow-anchor:none] [scrollbar-gutter:stable]"
			>
				{files.length > 0 && (
					<ul className="item-list">
						{files.map((file, index) => (
							<RecentFileItem
								key={file.id}
								file={file}
								arriving={feed.highlighted.has(file.id)}
								animateLayout={feed.nearTop}
								arrivalDelay={
									feed.highlighted.has(file.id)
										? Math.min(index * 0.03, 0.12)
										: 0
								}
							/>
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
					<div
						role="alert"
						className="space-y-2 px-2 py-3 text-xs text-red-300"
					>
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
			</m.section>
			<AnimatePresence>
				{feed.unreadCount > 0 && (
					<m.div
						key="new-files"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-4"
					>
						<button
							type="button"
							onClick={feed.reveal}
							className="pointer-events-auto flex min-h-8 items-center gap-1.5 rounded-full bg-indigo-300 px-3 text-xs font-medium text-zinc-950 hover:bg-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-100"
						>
							<ArrowUp size={14} aria-hidden="true" />
							{feed.unreadCount === 1
								? '1 novo arquivo'
								: `${feed.unreadCount} novos arquivos`}
						</button>
					</m.div>
				)}
			</AnimatePresence>
			<p role="status" aria-atomic="true" className="sr-only">
				{feed.unreadCount > 0
					? `${feed.unreadCount} novos arquivos disponíveis`
					: ''}
			</p>
		</div>
	)
}
