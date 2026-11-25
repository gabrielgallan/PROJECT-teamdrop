import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService, TokenExpiredError } from '@nestjs/jwt'
import { z } from 'zod'
import { AccessTokenClaims, AuthenticatedUser } from './auth.service.js'

const JWT_ALGORITHM = 'HS256'
const JWT_ISSUER = 'teamdrop-api'
const JWT_AUDIENCE = 'teamdrop-api'

const claimsSchema = z
	.object({
		sub: z.uuid(),
		sid: z.uuid(),
		iss: z.literal(JWT_ISSUER),
		aud: z.literal(JWT_AUDIENCE),
		iat: z.number().int().nonnegative(),
		exp: z.number().int().positive(),
	})
	.refine((claims) => claims.exp > claims.iat)

@Injectable()
export class AccessTokenService {
	constructor(private jwt: JwtService) {}

	async sign(userId: string, sessionId: string, sessionExpiresAt: Date) {
		const now = Math.floor(Date.now() / 1000)

		const expiresAt = Math.min(
			now + 15 * 60,
			Math.floor(sessionExpiresAt.getTime() / 1000),
		)

		if (expiresAt <= now) {
			throw new UnauthorizedException({
				code: 'INVALID_REFRESH_TOKEN',
				message: 'Session expired',
			})
		}

		const accessToken = await this.jwt.signAsync(
			{
				sub: userId,
				sid: sessionId,
				iat: now,
				exp: expiresAt,
			},
			{ algorithm: JWT_ALGORITHM, issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
		)

		return { accessToken, expiresIn: expiresAt - now }
	}

	async verify(token: string): Promise<AuthenticatedUser> {
		try {
			const payload = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
				algorithms: [JWT_ALGORITHM],
				issuer: JWT_ISSUER,
				audience: JWT_AUDIENCE,
			})
			const parsed = claimsSchema.safeParse(payload)
			if (!parsed.success) throw new Error('Invalid claims')
			return { userId: parsed.data.sub, sessionId: parsed.data.sid }
		} catch (error) {
			if (error instanceof TokenExpiredError) {
				throw new UnauthorizedException({
					code: 'ACCESS_TOKEN_EXPIRED',
					message: 'Access token expired',
				})
			}
			throw new UnauthorizedException({
				code: 'INVALID_ACCESS_TOKEN',
				message: 'Invalid access token',
			})
		}
	}
}
