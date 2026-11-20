import type { Member, SharedFile, Team } from '../types/team'

export const currentUser: Member = {
	id: 'you',
	name: 'Gabriel',
	initials: 'GA',
	avatarUrl: 'https://avatars.githubusercontent.com/u/163079177?v=4',
	color: 'bg-indigo-400/20 text-indigo-200',
}
export const teams: Team[] = [
	{ id: 'design', name: 'Equipe de produto', members: 8 },
	{ id: 'engineering', name: 'Engenharia', members: 12 },
	{ id: 'studio', name: 'Estúdio', members: 3 },
]

const members: Member[] = [
	{
		id: '1',
		name: 'Gabriel Gallan',
		initials: 'GG',
		color: 'bg-rose-400/15 text-rose-200',
		avatarUrl: 'https://avatars.githubusercontent.com/u/163079177?v=4',
	},
	{
		id: '2',
		name: 'Leonardo',
		initials: 'LE',
		color: 'bg-indigo-400/15 text-indigo-200',
		avatarUrl: 'https://avatars.githubusercontent.com/u/2254731?v=4',
	},
	{
		id: '3',
		name: 'Shadcn',
		initials: 'JM',
		color: 'bg-indigo-400/15 text-indigo-200',
		avatarUrl: 'https://avatars.githubusercontent.com/u/124599?v=4',
	},
]

export function screenshotSample() {
	const canvas = document.createElement('canvas')
	canvas.width = 960
	canvas.height = 600
	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('Não foi possível criar a captura de exemplo.')
	ctx.fillStyle = '#18181b'
	ctx.fillRect(0, 0, 960, 600)
	ctx.fillStyle = '#27272a'
	ctx.fillRect(0, 0, 960, 64)
	ctx.font = 'bold 22px system-ui'
	ctx.fillStyle = '#fafafa'
	ctx.fillText('TeamDrop', 32, 41)
	ctx.font = '16px system-ui'
	ctx.fillStyle = '#a1a1aa'
	ctx.fillText('Equipe de produto', 700, 40)
	ctx.fillStyle = '#fafafa'
	ctx.font = 'bold 30px system-ui'
	ctx.fillText('Tudo pronto para compartilhar.', 64, 144)
	ctx.font = '18px system-ui'
	ctx.fillStyle = '#a1a1aa'
	ctx.fillText('Arquivos e ideias, sempre perto da sua equipe.', 64, 186)
	for (let i = 0; i < 3; i++) {
		ctx.fillStyle = '#27272a'
		ctx.fillRect(40, 238 + i * 96, 880, 76)
		ctx.fillStyle = '#e4e4e7'
		ctx.fillText(['Exploração visual', 'Notas da reunião', 'Próximos passos'][i], 66, 284 + i * 96)
	}
	return canvas.toDataURL('image/png')
}

export function createMockFiles(): SharedFile[] {
	const now = Date.now()
	const sample = screenshotSample()
	return [
		{ name: 'Exploração visual.png', member: members[0], minutes: 29, kind: 'image' as const },
		{ name: 'Notas da reunião.txt', member: members[1], minutes: 48, kind: 'document' as const },
		{ name: 'Referências do produto.png', member: members[2], minutes: 95, kind: 'image' as const },
		{ name: 'Próximos passos.txt', member: currentUser, minutes: 156, kind: 'document' as const },
		{
			name: 'Planejamento anterior.txt',
			member: members[0],
			minutes: 3000,
			kind: 'document' as const,
		},
		{
			name: 'Notas de implementação.txt',
			member: members[1],
			minutes: 18,
			kind: 'document' as const,
			teamId: 'engineering',
		},
	].map((item, index) => {
		const text = `TeamDrop · arquivo de demonstração\n\n${item.name}\n\nCompartilhado por ${item.member.name}.\n\n• Revisar as ideias com a equipe\n• Reunir comentários\n• Preparar a próxima versão\n`
		return {
			isNew: index === 0,
			id: `mock-${index}`,
			teamId: item.teamId ?? 'design',
			name: item.name,
			member: item.member,
			createdAt: now - item.minutes * 60000,
			expiresAt: index === 4 ? now - 3600000 : now + 3 * 86400000,
			kind: item.kind,
			size: item.kind === 'image' ? '24 KB' : '1 KB',
			url:
				item.kind === 'image'
					? sample
					: `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`,
			link: `https://teamdrop.example/f/mock-${index}`,
			text: item.kind === 'document' ? text : undefined,
		}
	})
}
