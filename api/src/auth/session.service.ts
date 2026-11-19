import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../database/prisma/prisma.service.js'
import { AccessTokenService } from './access-token.service.js'
import { SESSION_TTL_SECONDS } from './auth.constants.js'
import { generateToken, hashToken } from './auth.crypto.js'
import type { TokenPair } from './auth.types.js'

@Injectable()
export class SessionService {
	constructor(
		private prisma: PrismaService,
		private accessTokens: AccessTokenService,
	) {}

	async create(userId: string): Promise<TokenPair> {
		const refreshToken = generateToken()
		const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)

		return this.prisma.$transaction(async (db) => {
			const session = await db.session.create({
				data: { userId, refreshTokenHash: hashToken(refreshToken), expiresAt },
			})
			return {
				...(await this.accessTokens.sign(userId, session.id, expiresAt)),
				refreshToken,
				tokenType: 'Bearer',
				refreshExpiresAt: expiresAt.toISOString(),
			}
		})
	}

	async rotate(refreshToken: string): Promise<TokenPair> {
		const previousHash = hashToken(refreshToken)
		const session = await this.prisma.session.findUnique({
			where: { refreshTokenHash: previousHash },
		})
		if (!session || session.expiresAt.getTime() <= Date.now()) {
			throw this.invalidRefreshToken()
		}

		const nextRefreshToken = generateToken()
		// Sign before consuming the refresh so a signing failure does not destroy the session.
		const access = await this.accessTokens.sign(session.userId, session.id, session.expiresAt)
		const updated = await this.prisma.session.updateMany({
			where: {
				id: session.id,
				refreshTokenHash: previousHash,
				expiresAt: { gt: new Date() },
			},
			data: { refreshTokenHash: hashToken(nextRefreshToken) },
		})
		// PostgreSQL rechecks this condition after concurrent updates: only one refresh wins.
		if (updated.count !== 1) throw this.invalidRefreshToken()

		return {
			...access,
			refreshToken: nextRefreshToken,
			tokenType: 'Bearer',
			refreshExpiresAt: session.expiresAt.toISOString(),
		}
	}

	async revoke(refreshToken: string): Promise<void> {
		await this.prisma.session.deleteMany({
			where: { refreshTokenHash: hashToken(refreshToken) },
		})
	}

	private invalidRefreshToken() {
		return new UnauthorizedException({
			code: 'INVALID_REFRESH_TOKEN',
			message: 'Invalid or expired refresh token',
		})
	}
}
