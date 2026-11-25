import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './use-auth'
import { authStore } from '../auth/auth.store'
import { uploadContent } from '../desktop/files.commands'
import { ApiError, errorMessage, isCancelled } from '../lib/api-error'
import { useAccountMutation } from '../api/use-account-mutation'
import { uploadTeamFile, type UploadTeamFileRequest } from '../api/files/upload-team-file'
import { queryKeys } from '../api/query-keys'
import type { PendingFile } from '../types/file'
import { uploadBatch } from '../api/files/upload-batch'

interface UploadState { teamId: string | null; pending: PendingFile[]; status: string; error: string }
const empty = (teamId: string | null): UploadState => ({ teamId, pending: [], status: '', error: '' })

export function useUploadQueue(teamId: string | null) {
	const { session, canQuery } = useAuth()
	const client = useQueryClient()
	const mutation = useAccountMutation(
		({ signal, ...request }: UploadTeamFileRequest & { signal: AbortSignal }) => uploadTeamFile(request, signal),
	)
	const [state, setState] = useState(() => empty(teamId))
	const controller = useRef<AbortController | null>(null)
	const liveTeam = useRef(teamId)
	liveTeam.current = teamId

	useEffect(() => {
		setState(empty(teamId))
		return () => { controller.current?.abort(); controller.current = null }
	}, [teamId])
	useEffect(() => { if (!canQuery) controller.current?.abort() }, [canQuery])


	async function share() {
		if (!teamId || !canQuery || liveTeam.current !== teamId || !state.pending.length || state.teamId !== teamId || controller.current) return
		const active = new AbortController()
		controller.current = active
		setState((previous) => ({ ...previous, error: '' }))
		try {
			await uploadBatch([...state.pending], active.signal, async (item, signal) => {
				const file = await uploadContent(item)
				signal.throwIfAborted()
				await mutation.mutateAsync({ teamId, file, signal })
			}, (item) => setState((previous) => previous.teamId === teamId
				? { ...previous, pending: previous.pending.filter((value) => value.id !== item.id) } : previous),
			(current, total) => setState((previous) => previous.teamId === teamId
				? { ...previous, status: `Enviando ${current} de ${total}…` } : previous))
		} catch (failure) {
			if (!active.signal.aborted && !isCancelled(failure)) setState((previous) => previous.teamId === teamId ? {
				...previous, error: failure instanceof ApiError ? errorMessage(failure)
					: 'Envio não confirmado. Confira a lista antes de reenviar os arquivos restantes.',
			} : previous)
		} finally {
			if (controller.current === active) {
				controller.current = null
				setState((previous) => ({ ...previous, status: '' }))
			}
			// A lost response may still mean the server accepted the file.
			if (authStore.getSnapshot().session === session && !authStore.getSnapshot().busy) {
				await client.invalidateQueries({ queryKey: [...queryKeys.team(session.user.id, teamId), 'files'] })
			}
		}
	}

	const current = state.teamId === teamId ? state : empty(teamId)
	return {
		...current, sharing: Boolean(current.status),
		isUploading: () => Boolean(controller.current),
		prepare: (pending: PendingFile[]) => {
			if (teamId && liveTeam.current === teamId && canQuery && !controller.current) setState({ ...empty(teamId), pending })
		},
		clear: () => { if (!controller.current) setState(empty(teamId)) },
		dismissError: () => setState((previous) => ({ ...previous, error: '' })),
		share,
	}
}
