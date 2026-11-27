import { createHash, randomBytes } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { CryptographyService } from '../../../src/common/cryptography/cryptography.service.js'
import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js'
import { AccessTokenService } from '../../../src/modules/auth/application/access-token.service.js'

export const authHelper = {
	generatePKCE,
	createUserAccess,
}

async function createUserAccess(app: INestApplication) {
	const prisma = app.get(PrismaService)
	const tokenService = app.get(AccessTokenService)
	const cryptoService = new CryptographyService()
	const refreshToken = cryptoService.generateToken()

	const user = await prisma.user.create({
		data: {
			name: 'John Doe',
			email: 'johndoe@email.com',
			sessions: {
				create: {
					expiresAt: new Date(Date.now() + 86_400 * 1000),
					refreshTokenHash: cryptoService.hashToken(refreshToken),
				},
			},
		},
		include: {
			sessions: true,
		},
	})

	const { accessToken } = await tokenService.sign(
		user.id,
		user.sessions[0].id,
		user.sessions[0].expiresAt,
	)

	return {
		user,
		accessToken,
		refreshToken,
	}
}

function generatePKCE() {
	const codeVerifier = randomBytes(32).toString('base64url')

	const codeChallenge = createHash('sha256')
		.update(codeVerifier)
		.digest('base64url')

	return {
		codeVerifier,
		codeChallenge,
	}
}
