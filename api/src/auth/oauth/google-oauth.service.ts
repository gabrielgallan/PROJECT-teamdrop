import { setTimeout as delay } from 'node:timers/promises'
import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common'
import { z } from 'zod'
import { EnvService } from '../../env/env.service.js'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

interface GoogleRequestInit {
	method?: 'GET' | 'POST'
	headers?: Record<string, string>
	body?: URLSearchParams
}

interface GoogleOAuthCallbackData {
	code: string
	codeVerifier: string
}

@Injectable()
export class GoogleOAuthService {
	private readonly logger = new Logger(GoogleOAuthService.name)

	constructor(private env: EnvService) {}

	async authenticate({ code: OAuthCode, codeVerifier }: GoogleOAuthCallbackData) {
		const googleOAuthBody = new URLSearchParams({
			code: OAuthCode,
			client_id: this.env.get('GOOGLE_OAUTH_CLIENT_ID'),
			client_secret: this.env.get('GOOGLE_OAUTH_CLIENT_SECRET'),
			redirect_uri: this.env.get('GOOGLE_OAUTH_CLIENT_REDIRECT_URI'),
			grant_type: 'authorization_code',
			code_verifier: codeVerifier,
		})

		const googleOAuthTokenResponse = await this.request(GOOGLE_TOKEN_URL, {
			method: 'POST',
			body: googleOAuthBody,
		})

		const OAuthResult = z
			.object({
				access_token: z.string(),
				token_type: z.literal('Bearer'),
				scope: z.string(),
			})
			.safeParse(googleOAuthTokenResponse)

		if (!OAuthResult.success) {
			throw new BadGatewayException({
				message: 'Wrong data format returned from Google OAuth API',
			})
		}

		const googleUserResponse = await this.request(GOOGLE_USERINFO_URL, {
			headers: {
				Authorization: `Bearer ${OAuthResult.data.access_token}`,
			},
		})

		const googleUserResult = z
			.object({
				sub: z.string(),
				email: z.string().nullish(),
				email_verified: z.boolean().default(false),
				name: z.string().nullish(),
				picture: z.url().nullish(),
			})
			.safeParse(googleUserResponse)

		if (!googleUserResult.success) {
			throw new BadGatewayException({
				message: 'Wrong user data returned from Google API',
			})
		}

		const {
			sub: googleId,
			email,
			email_verified: isEmailVerified,
			name,
			picture: avatarUrl,
		} = googleUserResult.data

		if (!email) {
			throw new BadRequestException({
				message: 'Provide a e-mail in your google account to authenticate!',
			})
		}

		if (!isEmailVerified) {
			throw new BadRequestException({
				message: 'Verify your google account e-mail before authenticating!',
			})
		}

		return {
			id: googleId,
			email,
			name: name ?? null,
			avatarUrl: avatarUrl ?? null,
		}
	}

	getAuthUrl(state: string, codeChallenge: string): string {
		const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')

		url.searchParams.set('client_id', this.env.get('GOOGLE_OAUTH_CLIENT_ID'))
		url.searchParams.set('redirect_uri', this.env.get('GOOGLE_OAUTH_CLIENT_REDIRECT_URI'))
		url.searchParams.set('response_type', 'code')
		url.searchParams.set('scope', 'openid email profile')
		url.searchParams.set('state', state)
		url.searchParams.set('code_challenge', codeChallenge)
		url.searchParams.set('code_challenge_method', 'S256')

		return url.toString()
	}

	private async request(
		url: string,
		{ method = 'GET', headers, body }: GoogleRequestInit = {},
	): Promise<unknown> {
		let response: Response

		for (let attempt = 0; ; attempt++) {
			try {
				response = await fetch(url, {
					method,
					headers: {
						Accept: 'application/json',
						...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
						...headers,
					},
					body,
					signal: AbortSignal.timeout(attempt === 0 ? 10_000 : 20_000),
				})
				break
			} catch (error) {
				// Only retry the profile lookup; authorization codes must not be exchanged twice.
				if (
					url === GOOGLE_USERINFO_URL &&
					method === 'GET' &&
					attempt === 0 &&
					error instanceof Error &&
					error.name === 'TimeoutError'
				) {
					this.logger.warn('Google profile request timed out; retrying in 1s with a 20s timeout')
					await delay(1_000)
					continue
				}
				this.logger.error({
					message: 'Google API request failed',
					endpoint: url === GOOGLE_TOKEN_URL ? 'token' : 'userinfo',
					method,
					errorType: error instanceof Error ? error.name : 'UnknownError',
				})

				throw new BadGatewayException(
					{ message: 'Failed to connect with Google API' },
					{ cause: error },
				)
			}
		}

		if (!response.ok) {
			throw new BadGatewayException({
				message: `Google API responded with status ${response.status}`,
			})
		}

		try {
			return await response.json()
		} catch {
			throw new BadGatewayException({
				message: 'Google API returned a non-JSON response',
			})
		}
	}
}
