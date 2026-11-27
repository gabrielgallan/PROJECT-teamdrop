import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js'

export const teamsHelper = {
	createTeam,
	addMember,
}

async function createTeam(prisma: PrismaService, ownerId: string) {
	const name = `Team ${randomUUID()}`

	return prisma.team.create({
		data: {
			name,
			slug: name.toLowerCase().replaceAll(' ', '-'),
			ownerId,
			members: { create: { userId: ownerId } },
		},
	})
}

async function addMember(
	prisma: PrismaService,
	teamId: string,
	userId: string,
) {
	return prisma.member.create({ data: { teamId, userId } })
}
