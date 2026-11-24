import { ReactQRCode } from '@lglab/react-qr-code'
import { Loader2, QrCode, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ScreenHeader } from '../components/screen-header'
import { fileError, generateFileUrl } from '../services/files'
import type { TeamFile } from '../types/file'

type QrState =
	| { status: 'loading' }
	| { status: 'error'; message: string }
	| { status: 'ready'; url: string; expiresAt: number }

export function FileQrScreen({ file, onBack }: { file: TeamFile; onBack: () => void }) {
	const back = useRef<HTMLButtonElement>(null)
	const [state, setState] = useState<QrState>({ status: 'loading' })
	const [attempt, setAttempt] = useState(0)
	const [now, setNow] = useState(Date.now)

	useEffect(() => {
		back.current?.focus()
	}, [])
	useEffect(() => {
		const controller = new AbortController()
		// The API does not return expiresAt. Start the five-minute window before
		// the request so network latency never extends the displayed validity.
		const startedAt = Date.now()
		setState({ status: 'loading' })
		void generateFileUrl(file.id, controller.signal)
			.then((url) => {
				if (controller.signal.aborted) return
				setNow(Date.now())
				setState({ status: 'ready', url, expiresAt: startedAt + 5 * 60_000 })
			})
			.catch((error) => {
				if (!controller.signal.aborted) setState({ status: 'error', message: fileError(error) })
			})
		return () => controller.abort()
	}, [file.id, attempt])

	useEffect(() => {
		const update = () => setNow(Date.now())
		const timer = setInterval(update, 1000)
		window.addEventListener('focus', update)
		document.addEventListener('visibilitychange', update)
		return () => {
			clearInterval(timer)
			window.removeEventListener('focus', update)
			document.removeEventListener('visibilitychange', update)
		}
	}, [])
	useEffect(() => {
		const escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault()
				onBack()
			}
		}
		window.addEventListener('keydown', escape)
		return () => window.removeEventListener('keydown', escape)
	}, [onBack])

	const color = '#ffffffb0'

	const remaining =
		state.status === 'ready' ? Math.max(0, Math.ceil((state.expiresAt - now) / 1000)) : 0
	const expired = state.status === 'ready' && remaining === 0
	return (
		<main className="flex h-full flex-col overflow-y-auto bg-zinc-900/50 text-white/90">
			<ScreenHeader
				title="QR Code do arquivo"
				backLabel="Voltar aos arquivos"
				onBack={onBack}
				backRef={back}
			/>
			<section
				aria-label="Compartilhar arquivo por QR Code"
				aria-busy={state.status === 'loading'}
				className="mx-4 mb-4 flex flex-1 flex-col items-center justify-center gap-4 text-center"
			>
				<p className="w-full break-words text-ui font-medium" title={file.name}>
					{file.name}
				</p>
				{state.status === 'loading' ? (
					<div
						role="status"
						className="flex min-h-60 items-center justify-center gap-2 text-xs text-white/70"
					>
						<Loader2 className="size-4 animate-spin" aria-hidden="true" />
						Gerando QR Code…
					</div>
				) : state.status === 'ready' && !expired ? (
					<>
						<div
							role="img"
							aria-label={`QR Code para abrir ${file.name}`}
							className="max-w-full overflow-hidden rounded-md [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
						>
							<ReactQRCode
								value={state.url}
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
							{expired ? 'Este QR Code expirou.' : state.status === 'error' ? state.message : ''}
						</p>
						<button
							type="button"
							onClick={() => setAttempt((value) => value + 1)}
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
