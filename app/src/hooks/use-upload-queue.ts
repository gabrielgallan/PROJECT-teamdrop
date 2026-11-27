import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { getFileUrl } from '../api/files/get-file-url'
import {
	type UploadTeamFileRequest,
	uploadTeamFile,
} from '../api/files/upload-team-file'
import { queryKeys } from '../api/query-keys'
import { useAccountMutation } from '../api/use-account-mutation'
import { authStore } from '../auth/auth.store'
import { copyText } from '../desktop/app.commands'
import { uploadContent } from '../desktop/files.commands'
import { ApiError, errorMessage, isCancelled } from '../lib/api-error'
import { recordFileArrival } from '../lib/file-arrivals'
import {
	createUploadJob,
	runUploadJob,
	type UploadJob,
} from '../lib/upload-job'
import type { PendingFile } from '../types/file'
import { useAuth } from './use-auth'

interface UploadState {
	teamId: string | null
	pending: PendingFile[]
	status: string
	error: string
	success: string
}
const empty = (teamId: string | null): UploadState => ({
	teamId,
	pending: [],
	status: '',
	error: '',
	success: '',
})

export function useUploadQueue(teamId: string | null, autoDrop = false) {
	const { session, canQuery } = useAuth()
	const client = useQueryClient()
	const mutation = useAccountMutation(
		({ signal, ...request }: UploadTeamFileRequest & { signal: AbortSignal }) =>
			uploadTeamFile(request, signal),
	)
	const [state, setState] = useState(() => empty(teamId))
	const controller = useRef<AbortController | null>(null)
	const jobRef = useRef<UploadJob | null>(null)
	const liveTeam = useRef(teamId)
	liveTeam.current = teamId

	useEffect(() => {
		jobRef.current = null
		setState(empty(teamId))
		return () => {
			controller.current?.abort()
			controller.current = null
			jobRef.current = null
		}
	}, [teamId, session])
	useEffect(() => {
		if (!canQuery) controller.current?.abort()
	}, [canQuery])
	useEffect(() => {
		if (!state.success) return
		const timer = setTimeout(
			() => setState((previous) => ({ ...previous, success: '' })),
			3500,
		)
		return () => clearTimeout(timer)
	}, [state.success])

	async function execute(job: UploadJob) {
		if (
			!canQuery ||
			controller.current ||
			jobRef.current !== job ||
			liveTeam.current !== job.teamId
		)
			return
		const active = new AbortController()
		controller.current = active
		job.failed = false
		const isCurrent = () =>
			jobRef.current === job &&
			authStore.getSnapshot().session === session &&
			liveTeam.current === job.teamId
		const assertActive = () => {
			active.signal.throwIfAborted()
			const auth = authStore.getSnapshot()
			if (
				!isCurrent() ||
				auth.needsLogin ||
				auth.busy !== null ||
				auth.status !== 'authenticated'
			) {
				throw new DOMException('Session changed', 'AbortError')
			}
		}
		setState((previous) => ({ ...previous, error: '', success: '' }))
		try {
			await runUploadJob(job, active.signal, {
				assertActive,
				send: async (item, signal) => {
					const file = await uploadContent(item)
					assertActive()
					return mutation.mutateAsync({ teamId: job.teamId, file, signal })
				},
				onConfirmed: (_item, uploaded) => {
					recordFileArrival(client, session.user.id, job.teamId, uploaded.id)
					setState((previous) => ({ ...previous, pending: [...job.pending] }))
				},
				onProgress: (current, total) =>
					setState((previous) => ({
						...previous,
						status:
							total === 1
								? 'Enviando arquivo…'
								: `Enviando ${current} de ${total}…`,
					})),
				onCopy: () =>
					setState((previous) => ({ ...previous, status: 'Copiando link…' })),
				getUrl: (fileId, signal) =>
					getFileUrl({ fileId, type: 'preview' }, signal),
				copy: copyText,
			})
			assertActive()
			setState((previous) => ({
				...previous,
				success: job.autoCopy
					? 'Link copiado · válido por 5 minutos'
					: 'Envio concluído',
			}))
		} catch (failure) {
			if (isCurrent() && authStore.getSnapshot().busy !== 'logout') {
				job.failed = true
				setState((previous) => ({
					...previous,
					pending: [...job.pending],
					error:
						active.signal.aborted || isCancelled(failure)
							? 'Operação interrompida. Confira a lista antes de tentar novamente.'
							: job.stage === 'copy'
								? 'Arquivo enviado, mas não foi possível copiar o link. Tente copiar novamente.'
								: failure instanceof ApiError
									? errorMessage(failure)
									: 'Envio não confirmado. Confira a lista antes de reenviar os arquivos restantes.',
				}))
			}
		} finally {
			if (controller.current === active) {
				controller.current = null
				if (isCurrent()) setState((previous) => ({ ...previous, status: '' }))
			}
			if (isCurrent() && !authStore.getSnapshot().busy) {
				void client.invalidateQueries({
					queryKey: [...queryKeys.team(session.user.id, job.teamId), 'files'],
				})
			}
		}
	}

	function clear() {
		if (controller.current) return
		jobRef.current = null
		setState(empty(teamId))
	}
	const current = state.teamId === teamId ? state : empty(teamId)
	return {
		...current,
		autoDrop,
		sharing: Boolean(current.status),
		blocked: Boolean(jobRef.current?.failed),
		retryLabel:
			jobRef.current?.stage === 'copy' ? 'Copiar link' : 'Tentar novamente',
		isUploading: () => Boolean(controller.current),
		prepare: (pending: PendingFile[]) => {
			if (
				!teamId ||
				!pending.length ||
				!canQuery ||
				liveTeam.current !== teamId ||
				controller.current ||
				jobRef.current?.failed
			)
				return
			const job = createUploadJob(teamId, pending, autoDrop)
			jobRef.current = job
			setState({ ...empty(teamId), pending: [...pending] })
			if (job.autoCopy) void execute(job)
		},
		clear,
		dismissError: clear,
		retry: () => {
			if (jobRef.current) void execute(jobRef.current)
		},
		share: async () => {
			if (jobRef.current) await execute(jobRef.current)
		},
	}
}
