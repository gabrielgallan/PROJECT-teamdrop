// Manual UI fixture: pnpm dev, then /tests/fixtures/feed-preview.html.
// Uses synthetic session/data and the real UI; no backend requests or credentials.
import '../../src/global.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { domMax, LazyMotion, MotionConfig } from 'motion/react'
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { teamFilesQuery } from '../../src/api/files/queries'
import { queryKeys } from '../../src/api/query-keys'
import { WorkspaceContext } from '../../src/app/contexts/workspace.context'
import { DropsScreen } from '../../src/app/screens/drops'
import { authStore } from '../../src/auth/auth.store'
import { recordFileArrival } from '../../src/lib/file-arrivals'
import { toastQueue } from '../../src/lib/toast-queue'

const user = {
	id: 'preview-user',
	name: 'Você',
	email: 'preview@example.test',
	avatarUrl: null,
}
const team = {
	id: 'preview-team',
	name: 'Design',
	slug: 'design',
	role: 'owner' as const,
	storageRetentionSeconds: 86400,
	createdAt: '',
	updatedAt: '',
}
authStore.update({
	status: 'authenticated',
	session: { user },
	busy: null,
	needsLogin: false,
})
const client = new QueryClient({
	defaultOptions: { queries: { staleTime: Infinity, retry: false } },
})
const key = teamFilesQuery(user.id, team.id).queryKey
let serial = 20
const makeFile = (id: number) => ({
	id: String(id),
	name:
		id > 20
			? `Proposta-${id}.pdf`
			: [
					'Identidade-visual.fig',
					'Referencias.zip',
					'Apresentacao.pdf',
					'Logotipo.svg',
				][id % 4],
	mimeType: 'application/pdf',
	size: 245760,
	createdAt: new Date(
		Date.now() - (20 - Math.min(id, 20)) * 60000,
	).toISOString(),
	author: { name: 'Ana Souza', email: 'ana@example.test', avatarUrl: null },
})
client.setQueryData(key, {
	pages: [
		{
			files: Array.from({ length: 20 }, (_, i) => makeFile(20 - i)),
			nextCursor: null,
		},
	],
	pageParams: [undefined],
})
client.setQueryData(queryKeys.teams(user.id), { teams: [team] })
const scroll = new Map<string, number>()
function receive(count = 1) {
	const files = Array.from({ length: count }, () =>
		makeFile(++serial),
	).reverse()
	for (const file of files) recordFileArrival(client, user.id, team.id, file.id)
	client.setQueryData(
		key,
		(previous) =>
			previous && {
				...previous,
				pages: [
					{
						...previous.pages[0],
						files: [...files, ...previous.pages[0].files],
					},
				],
			},
	)
}

function Preview() {
	const [status, setStatus] = useState('')
	const [success, setSuccess] = useState('')
	const queue = {
		teamId: team.id,
		pending: [],
		status,
		success,
		error: '',
		sharing: Boolean(status),
		blocked: false,
		autoDrop: false,
		retryLabel: 'Tentar novamente',
		retry() {},
		isUploading: () => Boolean(status),
		prepare() {},
		clear() {},
		dismissError() {},
		async share() {},
	}
	return (
		<QueryClientProvider client={client}>
			<MotionConfig
				reducedMotion="user"
				transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
			>
				<LazyMotion features={domMax} strict>
					<MemoryRouter>
						<div className="mx-auto flex min-h-screen flex-wrap items-center justify-center gap-6 bg-zinc-950 p-6">
							<div className="h-130 w-85 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
								<WorkspaceContext
									value={{
										team,
										teamsLoading: false,
										selectTeam() {},
										queue,
										scroll,
									}}
								>
									<DropsScreen />
								</WorkspaceContext>
							</div>
							<div className="flex w-48 flex-col gap-3 text-xs text-white/80 [&>button]:rounded-md [&>button]:bg-white/10 [&>button]:p-3">
								<p>Preview com dados fictícios · 340 × 520</p>
								<button type="button" onClick={() => receive()}>
									Receber arquivo
								</button>
								<button type="button" onClick={() => receive(5)}>
									Receber 5 arquivos
								</button>
								<button
									type="button"
									onClick={() => {
										setStatus('Enviando arquivo…')
										setTimeout(() => {
											receive()
											setStatus('')
											setSuccess('Arquivo enviado')
											setTimeout(() => setSuccess(''), 2000)
										}, 1000)
									}}
								>
									Simular upload
								</button>
								<button
									type="button"
									onClick={() => {
										client.setQueryData(
											queryKeys.realtime(user.id),
											'reconnecting',
										)
										setTimeout(
											() =>
												client.setQueryData(
													queryKeys.realtime(user.id),
													'connected',
												),
											4000,
										)
									}}
								>
									Simular reconexão
								</button>
								<button
									type="button"
									onClick={() => {
										toastQueue.add(String(++serial), 'Link copiado')
										toastQueue.add(String(++serial), 'Arquivo salvo')
									}}
								>
									Testar fila de avisos
								</button>
							</div>
						</div>
					</MemoryRouter>
				</LazyMotion>
			</MotionConfig>
		</QueryClientProvider>
	)
}

// Keep the fixture scrollable without changing the widget's actual dimensions.
document.body.style.overflow = 'auto'
const root = document.getElementById('root')
if (root) createRoot(root).render(<Preview />)
