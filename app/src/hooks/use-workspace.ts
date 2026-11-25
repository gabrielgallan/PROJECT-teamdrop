import { useContext } from 'react'
import { WorkspaceContext } from '../app/contexts/workspace.context'

function useWorkspace() {
	const value = useContext(WorkspaceContext)
	if (!value) throw new Error('WorkspaceProvider required')
	return value
}

export function useSelectedTeam() {
	const { team, selectTeam } = useWorkspace()
	return { team, selectTeam }
}

export function useTeamUploadQueue() {
	return useWorkspace().queue
}

export function useWorkspaceScroll() {
	return useWorkspace().scroll
}
