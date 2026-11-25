import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { userTeamsQuery } from '../../api/teams/queries'
import { useAuth } from '../../hooks/use-auth'
import { useUploadQueue } from '../../hooks/use-upload-queue'
import { WorkspaceContext } from '../contexts/workspace.context'

export function WorkspaceProvider({ children }: { children: ReactNode }) {
	const { user, canQuery } = useAuth()
	const listing = useQuery({ ...userTeamsQuery(user.id), enabled: canQuery })
	const storageKey = `teamdrop:selected-team:${user.id}`
	const [selectedId, setSelectedId] = useState<string | null>(() => {
		try {
			return localStorage.getItem(storageKey)
		} catch {
			return null
		}
	})
	const teams = listing.data?.teams ?? []
	const team =
		teams.find((value) => value.id === selectedId) ?? teams[0] ?? null
	const queue = useUploadQueue(team?.id ?? null)
	const scroll = useRef(new Map<string, number>())

	useEffect(() => {
		if (!listing.isSuccess) return
		setSelectedId(team?.id ?? null)
		try {
			if (team) localStorage.setItem(storageKey, team.id)
			else localStorage.removeItem(storageKey)
		} catch {
			/* Selection works without local storage. */
		}
	}, [listing.isSuccess, storageKey, team?.id])

	function selectTeam(id: string) {
		if (!queue.isUploading() && teams.some((value) => value.id === id))
			setSelectedId(id)
	}

	return (
		<WorkspaceContext
			value={{
				team,
				teamsLoading: canQuery && listing.isPending,
				selectTeam,
				queue,
				scroll: scroll.current,
			}}
		>
			{children}
		</WorkspaceContext>
	)
}
