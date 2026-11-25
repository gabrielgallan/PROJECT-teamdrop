import { createContext } from 'react'
import type { useUploadQueue } from '../../hooks/use-upload-queue'
import type { Team } from '../../types/team'

interface WorkspaceContextValue {
	team: Team | null
	teamsLoading: boolean
	selectTeam: (id: string) => void
	queue: ReturnType<typeof useUploadQueue>
	scroll: Map<string, number>
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
	null,
)
