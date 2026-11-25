import { ReactQRCode } from '@lglab/react-qr-code'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, QrCode, RefreshCw } from 'lucide-react'
import { useLocation, useParams } from 'react-router'
import { fileUrlQuery, teamFilesQuery } from '../../api/files/queries'
import { useAuth } from '../../hooks/use-auth'
import { useScreenBack } from '../../hooks/use-navigation'
import { useNow } from '../../hooks/use-now'
import { errorMessage } from '../../lib/api-error'
import { AuthNotice } from '../components/auth-notice'
import { ScreenHeader } from '../components/screen-header'

export function FileQrCodeScreen() {
	const { teamId = '', fileId = '' } = useParams()

	return <FileQrCode key={teamId + fileId} teamId={teamId} fileId={fileId} />
}

function FileQrCode({ teamId, fileId }: { teamId: string; fileId: string }) {
	const { user, canQuery } = useAuth()
	const query = useQuery({
		...fileUrlQuery(user.id, teamId, fileId),
		enabled: canQuery && Boolean(fileId),
	})
	const client = useQueryClient()
	const location = useLocation()
	const cached = client
		.getQueryData(teamFilesQuery(user.id, teamId).queryKey)
		?.pages.flatMap((page) => page.files)
		.find((file) => file.id === fileId)
	const file = {
		name:
			cached?.name ??
			(typeof location.state?.fileName === 'string'
				? location.state.fileName
				: 'Arquivo compartilhado'),
	}
	const back = useScreenBack('/', `qr-${fileId}`)
	const now = useNow()
	const color = '#ffffffb0'
	const remaining = query.data ? Math.max(0, Math.ceil((query.data.expiresAt - now) / 1000)) : 0
	const expired = Boolean(query.data) && remaining === 0
	return (
		<main className="flex h-full flex-col overflow-y-auto bg-zinc-900/50 text-white/90">
			<AuthNotice />
			<ScreenHeader
				title="QR Code do arquivo"
				backLabel="Voltar aos arquivos"
				onBack={back.onBack}
				backRef={back.backRef}
			/>
			<section
				aria-label="Compartilhar arquivo por QR Code"
				aria-busy={query.isFetching}
				className="mx-4 mb-4 flex flex-1 flex-col items-center justify-center gap-4 text-center"
			>
				<p className="w-full break-words text-ui font-medium" title={file.name}>
					{file.name}
				</p>
				{query.isFetching ? (
					<div
						role="status"
						className="flex min-h-60 items-center justify-center gap-2 text-xs text-white/70"
					>
						<Loader2 className="size-4 animate-spin" aria-hidden="true" />
						Gerando QR Code…
					</div>
				) : query.data && !expired ? (
					<>
						<div
							role="img"
							aria-label={`QR Code para abrir ${file.name}`}
							className="max-w-full overflow-hidden rounded-md [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
						>
							<ReactQRCode
								value={query.data?.url}
								size={200}
								marginSize={0}
								dataModulesSettings={{
									color,
									style: 'rounded',
								}}
								finderPatternOuterSettings={{
									color,
									style: 'rounded-sm',
								}}
								finderPatternInnerSettings={{
									color,
									style: 'rounded-sm',
								}}
								svgProps={{ 'aria-hidden': true }}
							/>
						</div>
						<div className="space-y-1 text-xs text-white/70">
							<p>Aponte a câmera do celular para abrir o arquivo.</p>
							<p className="tabular-nums">
								Expira em {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
							</p>
						</div>
					</>
				) : (
					<div className="flex min-h-60 flex-col items-center justify-center gap-4">
						<QrCode className="size-8 text-white/60" aria-hidden="true" />
						<p
							role={expired ? 'status' : 'alert'}
							className={`text-xs ${expired ? 'text-white/70' : 'text-red-300'}`}
						>
							{expired ? 'Este QR Code expirou.' : errorMessage(query.error)}
						</p>
						<button
							type="button"
							onClick={() => void query.refetch()}
							disabled={query.isFetching || !canQuery}
							className="flex min-h-8 items-center justify-center gap-2 bg-white/5 px-3 py-2 text-ui hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-300"
						>
							<RefreshCw className="size-4" aria-hidden="true" />
							{expired ? 'Gerar novo QR Code' : 'Tentar novamente'}
						</button>
					</div>
				)}
			</section>
		</main>
	)
}
