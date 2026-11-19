import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Header,
	HttpCode,
	Post,
	Query,
} from '@nestjs/common'
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiBody,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiOperation,
	ApiQuery,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { z } from 'zod'
import { AuthService } from './auth.service.js'
import type { AuthenticatedUser } from './auth.types.js'
import { CurrentUser } from './decorators/current-user.decorator.js'
import { Public } from './decorators/public.decorator.js'

const secret = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
const startBody = z.object({ codeChallenge: secret })
const exchangeBody = z.object({
	ticket: secret,
	codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
})
const refreshBody = z.object({ refreshToken: secret })
const callbackQuery = z.object({
	state: secret,
	code: z.string().min(1).max(4096).optional(),
	error: z.string().min(1).max(256).optional(),
})
const tokenPairSchema = {
	type: 'object',
	required: ['accessToken', 'refreshToken', 'tokenType', 'expiresIn', 'refreshExpiresAt'],
	properties: {
		accessToken: { type: 'string', description: 'JWT valid for at most 15 minutes' },
		refreshToken: {
			type: 'string',
			description: 'Rotating opaque secret; store in the OS credential vault',
		},
		tokenType: { type: 'string', enum: ['Bearer'] },
		expiresIn: { type: 'integer', maximum: 900 },
		refreshExpiresAt: {
			type: 'string',
			format: 'date-time',
			description: 'Fixed session expiration, 30 days after login',
		},
	},
}
const userSchema = {
	type: 'object',
	required: ['id', 'email', 'name', 'avatarUrl'],
	properties: {
		id: { type: 'string', format: 'uuid' },
		email: { type: 'string' },
		name: { type: 'string', nullable: true },
		avatarUrl: { type: 'string', nullable: true },
	},
}

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
	constructor(private auth: AuthService) {}

	@Public()
	@Post('desktop/start')
	@HttpCode(200)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({
		summary: 'Create a five-minute login; open authorizationUrl in the system browser',
	})
	@ApiBody({
		schema: {
			type: 'object',
			required: ['codeChallenge'],
			properties: {
				codeChallenge: {
					type: 'string',
					pattern: '^[A-Za-z0-9_-]{43}$',
					description: 'BASE64URL(SHA256(desktop verifier))',
				},
			},
		},
	})
	@ApiOkResponse({
		schema: {
			type: 'object',
			required: ['ticket', 'authorizationUrl', 'expiresIn', 'interval'],
			properties: {
				ticket: { type: 'string' },
				authorizationUrl: { type: 'string', format: 'uri' },
				expiresIn: { type: 'integer', example: 300 },
				interval: { type: 'integer', example: 2 },
			},
		},
	})
	@ApiBadRequestResponse({ description: 'Malformed code challenge' })
	startGoogleOAuth(@Body() body: unknown) {
		const parsed = startBody.safeParse(body)
		if (!parsed.success) throw new BadRequestException('A valid S256 codeChallenge is required')
		return this.auth.startDesktopLogin(parsed.data.codeChallenge)
	}

	@Public()
	@Get('google/callback')
	@Header('Content-Type', 'text/html; charset=utf-8')
	@Header('Cache-Control', 'no-store')
	@Header('Referrer-Policy', 'no-referrer')
	@ApiOperation({
		summary: 'Google redirect URI; completes the ticket without exposing tokens in the browser',
	})
	@ApiQuery({ name: 'state', required: true })
	@ApiQuery({ name: 'code', required: false })
	@ApiQuery({ name: 'error', required: false })
	@ApiOkResponse({ description: 'HTML instructing the user to return to Teamdrop' })
	@ApiBadRequestResponse({ description: 'Malformed callback' })
	@ApiUnauthorizedResponse({ description: 'Invalid, expired or already consumed OAuth state' })
	async authenticateWithGoogle(@Query() query: unknown) {
		const parsed = callbackQuery.safeParse(query)
		if (!parsed.success) throw new BadRequestException('Invalid OAuth callback')
		const { state, code, error } = parsed.data
		const success = await this.auth.completeGoogleLogin(state, code, error)
		const message = success
			? 'Login concluído. Você pode fechar esta aba e voltar ao Teamdrop.'
			: 'Não foi possível concluir o login. Volte ao Teamdrop e tente novamente.'
		return (
			'<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Teamdrop</title><p>' +
			message +
			'</p></html>'
		)
	}

	@Public()
	@Post('desktop/exchange')
	@HttpCode(200)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({
		summary: 'Poll every two seconds; consume the completed ticket once to obtain tokens',
	})
	@ApiBody({
		schema: {
			type: 'object',
			required: ['ticket', 'codeVerifier'],
			properties: {
				ticket: { type: 'string' },
				codeVerifier: { type: 'string', minLength: 43, maxLength: 128 },
			},
		},
	})
	@ApiOkResponse({
		schema: {
			oneOf: [
				{
					type: 'object',
					required: ['status'],
					properties: { status: { type: 'string', enum: ['pending'] } },
				},
				{
					...tokenPairSchema,
					required: [...tokenPairSchema.required, 'status', 'user'],
					properties: {
						...tokenPairSchema.properties,
						status: { type: 'string', enum: ['complete'] },
						user: userSchema,
					},
				},
			],
		},
	})
	@ApiBadRequestResponse({ description: 'Malformed ticket or verifier' })
	@ApiUnauthorizedResponse({
		description: 'Invalid, expired, denied or already consumed ticket; incorrect verifier',
	})
	exchange(@Body() body: unknown) {
		const parsed = exchangeBody.safeParse(body)
		if (!parsed.success) throw new BadRequestException('Invalid desktop exchange')
		return this.auth.exchangeDesktopLogin(parsed.data.ticket, parsed.data.codeVerifier)
	}

	@Public()
	@Post('refresh')
	@HttpCode(200)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Rotate the refresh token; session expiration is never extended' })
	@ApiBody({
		schema: {
			type: 'object',
			required: ['refreshToken'],
			properties: {
				refreshToken: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' },
			},
		},
	})
	@ApiOkResponse({ schema: tokenPairSchema })
	@ApiBadRequestResponse({ description: 'Malformed refresh token' })
	@ApiUnauthorizedResponse({
		description: 'INVALID_REFRESH_TOKEN: unknown, expired or already rotated refresh token',
	})
	refresh(@Body() body: unknown) {
		const parsed = refreshBody.safeParse(body)
		if (!parsed.success) throw new BadRequestException('Invalid refresh token format')
		return this.auth.refresh(parsed.data.refreshToken)
	}

	@Get('me')
	@ApiBearerAuth()
	@Header('Cache-Control', 'no-store')
	@ApiOkResponse({
		schema: { type: 'object', required: ['user'], properties: { user: userSchema } },
	})
	@ApiUnauthorizedResponse({
		description: 'INVALID_ACCESS_TOKEN, ACCESS_TOKEN_EXPIRED, or user no longer exists',
	})
	async me(@CurrentUser() user: AuthenticatedUser) {
		return { user: await this.auth.getProfile(user.userId) }
	}

	@Public()
	@Post('logout')
	@HttpCode(204)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({
		summary: 'Revoke this session using its current refresh token; repeated calls succeed',
	})
	@ApiBody({
		schema: {
			type: 'object',
			required: ['refreshToken'],
			properties: {
				refreshToken: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' },
			},
		},
	})
	@ApiNoContentResponse({
		description:
			'Session removed or refresh token already invalid; issued JWTs remain valid until expiration',
	})
	@ApiBadRequestResponse({ description: 'Malformed refresh token' })
	logout(@Body() body: unknown) {
		const parsed = refreshBody.safeParse(body)
		if (!parsed.success) throw new BadRequestException('Invalid refresh token format')
		return this.auth.logout(parsed.data.refreshToken)
	}
}
