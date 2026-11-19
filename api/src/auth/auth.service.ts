import { Injectable, UnauthorizedException } from '@nestjs/common'
import { CacheRepository } from '../cache/cache.interface.js'
import { PrismaService } from '../database/prisma/prisma.service.js'
import { generateToken, hashToken } from './auth.crypto.js'
import { DesktopTicketService, LOGIN_TTL_SECONDS } from './desktop-ticket.service.js'
import { GoogleOAuthService } from './oauth/google-oauth.service.js'
import { SessionService } from './session.service.js'

const userSelect = { id: true, email: true, name: true, avatarUrl: true } as const

@Injectable()
export class AuthService {
	constructor(
		private googleOAuth: GoogleOAuthService,
		private prisma: PrismaService,
		private cache: CacheRepository,
		private tickets: DesktopTicketService,
		private sessions: SessionService,
	) {}

	async startDesktopLogin(codeChallenge: string) {
		const state = generateToken()
		const codeVerifier = generateToken()
		const ticket = await this.tickets.create(codeChallenge)
		await this.cache.set(
			`auth:oauth:${hashToken(state)}`,
			JSON.stringify({ codeVerifier, ticket }),
			LOGIN_TTL_SECONDS,
		)
		return {
			ticket,
			authorizationUrl: this.googleOAuth.getAuthUrl(state, hashToken(codeVerifier)),
			expiresIn: LOGIN_TTL_SECONDS,
			interval: 2,
		}
	}

	async completeGoogleLogin(state: string, code?: string, error?: string) {
		const attempt = await this.cache.getDel(`auth:oauth:${hashToken(state)}`)
		if (!attempt) throw new UnauthorizedException('Invalid or expired OAuth state')
		const { codeVerifier, ticket } = JSON.parse(attempt) as { codeVerifier: string; ticket: string }
		if (error || !code) {
			await this.tickets.complete(ticket)
			return false
		}

		try {
			const profile = await this.googleOAuth.authenticate({ code, codeVerifier })
			const user = await this.prisma.$transaction(async (db) => {
				// The provider subject is the identity; never silently link accounts by email.
				const account = await db.account.findUnique({
					where: { providerAccountId: profile.id },
				})
				if (account) {
					if (account.provider !== 'GOOGLE')
						throw new UnauthorizedException('Invalid account provider')
					return db.user.update({
						where: { id: account.userId },
						data: { name: profile.name, avatarUrl: profile.avatarUrl },
						select: userSelect,
					})
				}
				if (await db.user.findUnique({ where: { email: profile.email } })) {
					throw new UnauthorizedException('This email is already associated with another identity')
				}
				return db.user.create({
					data: {
						email: profile.email,
						name: profile.name,
						avatarUrl: profile.avatarUrl,
						accounts: { create: { provider: 'GOOGLE', providerAccountId: profile.id } },
					},
					select: userSelect,
				})
			})
			return await this.tickets.complete(ticket, user.id)
		} catch {
			await this.tickets.complete(ticket)
			return false
		}
	}

	async exchangeDesktopLogin(ticket: string, codeVerifier: string) {
		const userId = await this.tickets.exchange(ticket, codeVerifier)
		if (!userId) return { status: 'pending' as const }
		const user = await this.getProfile(userId)
		return { status: 'complete' as const, ...(await this.sessions.create(userId)), user }
	}

	refresh(refreshToken: string) {
		return this.sessions.rotate(refreshToken)
	}

	logout(refreshToken: string) {
		return this.sessions.revoke(refreshToken)
	}

	async getProfile(userId: string) {
		const user = await this.prisma.user.findUnique({ where: { id: userId }, select: userSelect })
		if (!user) throw new UnauthorizedException('User no longer exists')
		return user
	}
}
