import type { ApiFileWithAuthor, TeamFile } from '../../types/file'
import type { Member } from '../../types/team'

export function memberView(user: { id?: string; name: string | null; email: string; avatarUrl: string | null }): Member {
	const name = user.name?.trim() || user.email
	return {
		id: user.id ?? user.email, name,
		avatarUrl: user.avatarUrl ?? undefined,
		initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
		color: 'bg-indigo-400/15 text-indigo-100',
	}
}

export function fileView(file: ApiFileWithAuthor, teamId: string): TeamFile {
	const units = ['B', 'KB', 'MB', 'GB', 'TB']
	const unit = file.size > 0 ? Math.min(Math.floor(Math.log(file.size) / Math.log(1024)), units.length - 1) : 0
	return {
		id: file.id, teamId, name: file.name, mimeType: file.mimeType,
		size: `${Number((file.size / 1024 ** unit).toFixed(unit > 0 ? 1 : 0))} ${units[unit]}`,
		createdAt: new Date(file.createdAt).getTime(),
		kind: file.mimeType.startsWith('image/') ? 'image' : 'document',
		member: memberView(file.author),
	}
}

export function relativeTime(date: number, now: number) {
	const minutes = Math.max(0, Math.floor((now - date) / 60000))
	if (minutes < 1) return 'agora'
	if (minutes < 60) return `há ${minutes} min`
	if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`
	return `há ${Math.floor(minutes / 1440)} d`
}
