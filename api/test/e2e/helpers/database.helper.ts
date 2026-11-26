import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js'

export const databaseHelper = {
	cleanupDatabase,
}

async function cleanupDatabase(prisma: PrismaService) {
	await prisma.$executeRaw`
		TRUNCATE TABLE users, teams, invites, members, sessions, files
		RESTART IDENTITY CASCADE
	`
}
