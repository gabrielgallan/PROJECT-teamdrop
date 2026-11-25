import {
	Inject,
	Injectable,
	Logger,
	UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'
import { CryptographyService } from '../../../common/cryptography/cryptography.service.js'
import {
	CacheService,
	ICacheService,
} from '../../../infrastructure/cache/cache.interface.js'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js'
import { GoogleOAuthService } from '../oauth/google-oauth.service.js'
import { UserPresenter } from '../presentation/presenters/user.presenter.js'
import {
	DesktopTicketService,
	LOGIN_TTL_SECONDS,
} from './desktop-ticket.service.js'
import { SessionService } from './session.service.js'

const userSelect = {
	id: true,
	email: true,
	name: true,
	avatarUrl: true,
} as const

export interface AuthenticatedUser {
	userId: string
	sessionId: string
}

export interface AccessTokenClaims {
	sub: string
	sid: string
	iss: string
	aud: string
	iat: number
	exp: number
}

export type AuthenticatedRequest = Request & { user: AuthenticatedUser }

export interface TokenPair {
	accessToken: string
	refreshToken: string
	tokenType: 'Bearer'
	expiresIn: number
	refreshExpiresAt: string
}

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name)

	constructor(
		private googleOAuth: GoogleOAuthService,
		private prisma: PrismaService,
		@Inject(CacheService)
		private cache: ICacheService,
		private tickets: DesktopTicketService,
		private sessions: SessionService,
		private cryptoService: CryptographyService,
	) {}

	async startDesktopLogin(codeChallenge: string) {
		const state = this.cryptoService.generateToken()
		const codeVerifier = this.cryptoService.generateToken()
		const ticket = await this.tickets.create(codeChallenge)

		await this.cache.set(
			`auth:oauth:${this.cryptoService.hashToken(state)}`,
			JSON.stringify({ codeVerifier, ticket }),
			LOGIN_TTL_SECONDS,
		)
		return {
			ticket,
			authorizationUrl: this.googleOAuth.getAuthUrl(
				state,
				this.cryptoService.hashToken(codeVerifier),
			),
			expiresIn: LOGIN_TTL_SECONDS,
			interval: 2,
		}
	}

	async completeGoogleLogin(state: string, code?: string, error?: string) {
		const attempt = await this.cache.getDel(
			`auth:oauth:${this.cryptoService.hashToken(state)}`,
		)

		if (!attempt)
			throw new UnauthorizedException({
				message: 'Invalid or expired OAuth state',
			})

		const { codeVerifier, ticket } = JSON.parse(attempt) as {
			codeVerifier: string
			ticket: string
		}

		if (error || !code) {
			await this.tickets.complete(ticket)

			return false
		}

		let stage = 'google-oauth'
		try {
			const profile = await this.googleOAuth.authenticate({
				code,
				codeVerifier,
			})

			stage = 'database'
			const user = await this.prisma.$transaction(async (db) => {
				// The provider subject is the identity; never silently link accounts by email.
				const account = await db.account.findUnique({
					where: { providerAccountId: profile.id },
				})
				if (account) {
					if (account.provider !== 'GOOGLE') {
						throw new UnauthorizedException({
							message: 'Invalid account provider',
						})
					}

					return db.user.update({
						where: { id: account.userId },
						data: { name: profile.name, avatarUrl: profile.avatarUrl },
						select: userSelect,
					})
				}

				if (await db.user.findUnique({ where: { email: profile.email } })) {
					throw new UnauthorizedException({
						message: 'This email is already associated with another identity',
					})
				}
				return db.user.create({
					data: {
						email: profile.email,
						name: profile.name,
						avatarUrl: profile.avatarUrl,
						accounts: {
							create: { provider: 'GOOGLE', providerAccountId: profile.id },
						},
					},
					select: userSelect,
				})
			})
			stage = 'complete-ticket'
			return await this.tickets.complete(ticket, user.id)
		} catch (err) {
			const code =
				err && typeof err === 'object' && 'code' in err ? err.code : undefined
			this.logger.error({
				message: 'Google login failed',
				stage,
				errorType: err instanceof Error ? err.name : 'UnknownError',
				code:
					typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)
						? code
						: undefined,
			})

			await this.tickets.complete(ticket)

			return false
		}
	}

	async exchangeDesktopLogin(ticket: string, codeVerifier: string) {
		const userId = await this.tickets.exchange(ticket, codeVerifier)
		if (!userId) return { status: 'pending' as const }
		const { user } = await this.getProfile(userId)
		return {
			status: 'complete' as const,
			...(await this.sessions.create(userId)),
			user: UserPresenter.toHTTP(user),
		}
	}

	refresh(refreshToken: string) {
		return this.sessions.rotate(refreshToken)
	}

	logout(refreshToken: string) {
		return this.sessions.revoke(refreshToken)
	}

	async getProfile(userId: string) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: userSelect,
		})

		if (!user) {
			throw new UnauthorizedException({
				message: 'User no longer exists',
			})
		}

		return {
			user,
		}
	}
}
