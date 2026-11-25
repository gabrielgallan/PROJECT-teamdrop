import {
	Body,
	Controller,
	Get,
	Header,
	HttpCode,
	Post,
	Query,
} from '@nestjs/common'
import {
	ApiBearerAuth,
	ApiExcludeEndpoint,
	ApiExtraModels,
	ApiOkResponse,
	ApiOperation,
	ApiResponse,
	ApiTags,
	getSchemaPath,
} from '@nestjs/swagger'
import { ApiErrorResponseDto } from '../dtos/api-error-response.dto.js'
import { HtmlPage } from '../html/page.decorator.js'
import { htmlPageTemplate } from '../html/page.template.js'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js'
import { CurrentUser } from './decorators/current-user.decorator.js'
import { Public } from './decorators/public.decorator.js'
import {
	ExchangeCompleteResponseDto,
	ExchangeDesktopDto,
	ExchangePendingResponseDto,
	exchangeDesktopSchema,
} from './dtos/exchange-desktop.dto.js'
import {
	GoogleCallbackQueryDto,
	googleCallbackQuerySchema,
} from './dtos/google-callback.dto.js'
import { ProfileResponseDto } from './dtos/public-user.dto.js'
import {
	RefreshTokenDto,
	RefreshTokenResponseDto,
	refreshTokenSchema,
} from './dtos/refresh-token.dto.js'
import {
	StartDesktopLoginDto,
	StartDesktopLoginResponseDto,
	startDesktopLoginSchema,
} from './dtos/start-desktop.dto.js'
import { UserPresenter } from './presenters/user.presenter.js'
import { AuthenticatedUser, AuthService } from './services/auth.service.js'

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
	constructor(private authService: AuthService) {}

	@Public()
	@Post('desktop/start')
	@HttpCode(200)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({
		summary:
			'Create a five-minute login; open authorizationUrl in the system browser',
	})
	@ApiResponse({ status: 200, type: StartDesktopLoginResponseDto })
	@ApiResponse({ status: 400, type: ApiErrorResponseDto })
	startGoogleOAuth(
		@Body(new ZodValidationPipe(startDesktopLoginSchema))
		body: StartDesktopLoginDto,
	) {
		const { codeChallenge } = body

		return this.authService.startDesktopLogin(codeChallenge)
	}

	@ApiExcludeEndpoint()
	@Public()
	@Get('google/callback')
	@HttpCode(200)
	@HtmlPage()
	async authenticateWithGoogle(
		@Query(new ZodValidationPipe(googleCallbackQuerySchema))
		query: GoogleCallbackQueryDto,
	) {
		const { state, code, error } = query

		const success = await this.authService.completeGoogleLogin(
			state,
			code,
			error,
		)

		const title = success ? 'Login concluído' : 'Falha na autenticação'

		const description = success
			? 'Sua autenticação foi realizada com sucesso. Você já pode fechar esta aba e voltar ao Teamdrop.'
			: 'Não foi possível concluir seu login. Volte ao Teamdrop e tente novamente.'

		const icon = success
			? '<path d="m5 12 4 4L19 6"/>'
			: '<path d="M18 6 6 18M6 6l12 12"/>'

		return htmlPageTemplate({
			title: `${title} - Teamdrop`,
			content: `
				<div class="icon ${success ? 'icon-success' : 'icon-error'}">
					<svg
						width="22"
						height="22"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						${icon}
					</svg>
				</div>

				<h1>${title}</h1>

				<p class="description">${description}</p>

				<div class="divider"></div>

				<p class="help-text">
					${success ? 'Continue no aplicativo.' : 'Tente novamente pelo aplicativo.'}
				</p>
			`,
		})
	}

	@Public()
	@Post('desktop/exchange')
	@HttpCode(200)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({
		summary:
			'Poll every two seconds; consume the completed ticket once to obtain tokens',
	})
	@ApiExtraModels(ExchangePendingResponseDto, ExchangeCompleteResponseDto)
	@ApiOkResponse({
		schema: {
			oneOf: [
				{ $ref: getSchemaPath(ExchangePendingResponseDto.Output) },
				{ $ref: getSchemaPath(ExchangeCompleteResponseDto.Output) },
			],
		},
	})
	@ApiResponse({ status: 200 })
	@ApiResponse({ status: 400, description: 'Malformed ticket or verifier' })
	@ApiResponse({
		status: 401,
		description:
			'Invalid, expired, denied or already consumed ticket; incorrect verifier',
	})
	exchange(
		@Body(
			new ZodValidationPipe(exchangeDesktopSchema, 'Invalid desktop exchange'),
		)
		body: ExchangeDesktopDto,
	) {
		const { ticket, codeVerifier } = body

		return this.authService.exchangeDesktopLogin(ticket, codeVerifier)
	}

	@Public()
	@Post('refresh')
	@HttpCode(200)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({
		summary: 'Rotate the refresh token; session expiration is never extended',
	})
	@ApiResponse({ status: 200, type: RefreshTokenResponseDto })
	@ApiResponse({ status: 400, description: 'Malformed refresh token' })
	@ApiResponse({
		status: 401,
		description:
			'INVALID_REFRESH_TOKEN: unknown, expired or already rotated refresh token',
	})
	refresh(
		@Body(
			new ZodValidationPipe(refreshTokenSchema, 'Invalid refresh token format'),
		)
		body: RefreshTokenDto,
	) {
		return this.authService.refresh(body.refreshToken)
	}

	@Public()
	@Post('logout')
	@HttpCode(204)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({
		summary:
			'Revoke this session using its current refresh token; repeated calls succeed',
	})
	@ApiResponse({
		status: 204,
		description:
			'Session removed or refresh token already invalid; issued JWTs remain valid until expiration',
	})
	@ApiResponse({ status: 400, description: 'Malformed refresh token' })
	logout(
		@Body(
			new ZodValidationPipe(refreshTokenSchema, 'Invalid refresh token format'),
		)
		body: RefreshTokenDto,
	) {
		return this.authService.logout(body.refreshToken)
	}

	@Get('profile')
	@HttpCode(200)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Get authenticated user profile',
	})
	@ApiResponse({
		status: 200,
		type: ProfileResponseDto,
	})
	@ApiResponse({
		status: 401,
		description:
			'INVALID_ACCESS_TOKEN, ACCESS_TOKEN_EXPIRED, or user no longer exists',
	})
	async getProfile(@CurrentUser() user: AuthenticatedUser) {
		const result = await this.authService.getProfile(user.userId)

		return {
			user: UserPresenter.toHTTP(result.user),
		}
	}
}
