import type { TeamSettings, TeamSettingsMember } from '../types/team'
import { ApiError, apiRequest } from './api'

export interface ApiTeam {
	id: string
	name: string
	slug: string
	role: 'owner' | 'member'
}
export interface InvitePreview {
	team: Pick<ApiTeam, 'id' | 'name' | 'slug'>
	alreadyMember: boolean
}

export function teamView(team: ApiTeam): TeamSettings {
	return {
		id: team.id,
		name: team.name,
		slug: team.slug,
		role: team.role,
		members: [],
	}
}
export async function listTeams(signal?: AbortSignal) {
	return (await apiRequest<{ teams: ApiTeam[] }>('/api/teams', { signal })).teams
}
export async function createTeam(name: string) {
	return (
		await apiRequest<{ team: ApiTeam }>('/api/teams', {
			method: 'POST',
			body: JSON.stringify({ name }),
		})
	).team
}
export async function renameTeam(teamId: string, newName: string) {
	return (
		await apiRequest<{ team: ApiTeam }>(`/api/teams/${encodeURIComponent(teamId)}`, {
			method: 'PATCH',
			body: JSON.stringify({ newName }),
		})
	).team
}
export function leaveTeam(teamId: string) {
	return apiRequest<void>(`/api/teams/${encodeURIComponent(teamId)}/members/me`, { method: 'DELETE' })
}
export function removeMember(teamId: string, memberId: string) {
	return apiRequest<void>(
		`/api/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberId)}`,
		{ method: 'DELETE' },
	)
}
export async function listMembers(teamId: string): Promise<TeamSettingsMember[]> {
	const { users } = await apiRequest<{
		users: {
			id: string
			name: string | null
			email: string
			avatarUrl: string | null
			role: 'owner' | 'member'
		}[]
	}>(`/api/teams/${encodeURIComponent(teamId)}/members`)
	return users.map((user) => {
		const name = user.name?.trim() || user.email
		return {
			id: user.id,
			name,
			role: user.role,
			avatarUrl: user.avatarUrl ?? undefined,
			initials: name
				.split(/\s+/)
				.slice(0, 2)
				.map((part) => part[0])
				.join('')
				.toUpperCase(),
			color: 'bg-indigo-400/15 text-indigo-100',
		}
	})
}
export async function createInvite(teamId: string) {
	return (
		await apiRequest<{ url: string }>(`/api/teams/${encodeURIComponent(teamId)}/invites`, {
			method: 'POST',
			body: JSON.stringify({}),
		})
	).url
}
export function revokeInvite(teamId: string) {
	return apiRequest<void>(`/api/teams/${encodeURIComponent(teamId)}/invites`, { method: 'DELETE' })
}
export function previewInvite(token: string, signal?: AbortSignal) {
	return apiRequest<InvitePreview>(`/api/invites/${encodeURIComponent(token)}/preview`, { signal })
}
export function acceptInvite(token: string) {
	return apiRequest<{ team: ApiTeam }>('/api/invites/accept', {
		method: 'POST',
		body: JSON.stringify({ token }),
	})
}
export function teamError(error: unknown): string {
	if (error instanceof ApiError) {
		if (error.status === 401)
			return 'Sua sessão precisa ser renovada. Entre novamente se necessário.'
		if (error.status === 403) return 'Você não tem permissão para esta ação.'
		if (error.status === 404) return 'O time ou membro não está mais disponível. Atualize a lista.'
		if (error.status === 409) return 'Já existe um time com esse nome.'
		if (error.status === 410)
			return 'O convite expirou, foi revogado ou atingiu o limite de usos. Peça um novo link.'
		if (error.status === 400) return 'Confira os dados e tente novamente.'
	}
	return 'Não foi possível concluir a solicitação. Verifique a conexão e tente novamente.'
}
