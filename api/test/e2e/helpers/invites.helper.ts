import { CryptographyService } from '../../../src/common/cryptography/cryptography.service.js'
import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js'

export const invitesHelper = {
	createInvite,
}

async function createInvite(
	prisma: PrismaService,
	teamId: string,
	authorId: string,
) {
	const cryptoService = new CryptographyService()
	const token = cryptoService.generateToken()
	const invite = await prisma.invite.create({
		data: {
			teamId,
			authorId,
			tokenHash: cryptoService.hashToken(token, 'hex'),
			maxUses: 100,
			expiresAt: new Date(Date.now() + 86400 * 1000),
		},
	})

	return { ...invite, token }
}
