import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { handleAuthFailure } from '../auth/auth.errors'
import { authStore } from '../auth/auth.store'
import { authCommands } from '../desktop/auth.commands'
import { env } from '../env'
import { connectFilesRealtime } from '../lib/files-realtime'
import type { Team } from '../types/team'
import { useAuth } from './use-auth'

export function useFilesRealtime(teams: Team[], loaded: boolean) {
	const { session, canQuery } = useAuth()
	const client = useQueryClient()
	const teamIdsKey = JSON.stringify(
		[...new Set(teams.map((team) => team.id))].sort(),
	)

	useEffect(() => {
		if (!canQuery || !loaded) return
		return connectFilesRealtime({
			baseUrl: env.VITE_API_URL,
			userId: session.user.id,
			teamIds: JSON.parse(teamIdsKey) as string[],
			client,
			getAccessToken: authCommands.getAccessToken,
			onAuthFailure: handleAuthFailure,
			isActive: () => {
				const state = authStore.getSnapshot()
				return (
					state.session === session &&
					state.status === 'authenticated' &&
					!state.needsLogin &&
					state.busy === null
				)
			},
		})
	}, [session, canQuery, loaded, teamIdsKey, client])
}
