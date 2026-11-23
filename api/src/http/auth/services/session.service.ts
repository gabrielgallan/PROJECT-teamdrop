import { Injectable, UnauthorizedException } from '@nestjs/common'
import { CryptographyService } from '../../../cryptography/cryptography.service.js'
import { PrismaService } from '../../../database/prisma/prisma.service.js'
import { AccessTokenService } from './access-token.service.js'
import { TokenPair } from './auth.service.js'

@Injectable()
export class SessionService {
	constructor(
		private prisma: PrismaService,
		private accessTokens: AccessTokenService,
		private cryptoService: CryptographyService,
	) {}

	async create(userId: string): Promise<TokenPair> {
		const refreshToken = this.cryptoService.generateToken()
		const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

		return this.prisma.$transaction(async (db) => {
			const session = await db.session.create({
				data: { userId, refreshTokenHash: this.cryptoService.hashToken(refreshToken), expiresAt },
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
		const previousHash = this.cryptoService.hashToken(refreshToken)
		const session = await this.prisma.session.findUnique({
			where: { refreshTokenHash: previousHash },
		})
		if (!session || session.expiresAt.getTime() <= Date.now()) {
			throw this.invalidRefreshToken()
		}

		const nextRefreshToken = this.cryptoService.generateToken()
		// Sign before consuming the refresh so a signing failure does not destroy the session.
		const access = await this.accessTokens.sign(session.userId, session.id, session.expiresAt)
		const updated = await this.prisma.session.updateMany({
			where: {
				id: session.id,
				refreshTokenHash: previousHash,
				expiresAt: { gt: new Date() },
			},
			data: { refreshTokenHash: this.cryptoService.hashToken(nextRefreshToken) },
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
			where: { refreshTokenHash: this.cryptoService.hashToken(refreshToken) },
		})
	}

	private invalidRefreshToken() {
		return new UnauthorizedException({
			code: 'INVALID_REFRESH_TOKEN',
			message: 'Invalid or expired refresh token',
		})
	}
}
