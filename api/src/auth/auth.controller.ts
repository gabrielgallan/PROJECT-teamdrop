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
	ApiExtraModels,
	ApiOkResponse,
	ApiOperation,
	ApiResponse,
	ApiTags,
	getSchemaPath,
} from '@nestjs/swagger'
import { ApiErrorResponseDto } from '../http/dtos/api-error-response.dto.js'
import { ZodValidationPipe } from '../http/pipes/zod-validation.pipe.js'
import { Public } from './decorators/public.decorator.js'
import { ExchangeCompleteResponseDto, ExchangeDesktopDto, ExchangePendingResponseDto, exchangeDesktopSchema } from './dtos/exchange-desktop.dto.js'
import { GoogleCallbackQueryDto, googleCallbackQuerySchema } from './dtos/google-callback.dto.js'
import { RefreshTokenDto, RefreshTokenResponseDto, refreshTokenSchema } from './dtos/refresh-token.dto.js'
import { StartDesktopLoginDto, StartDesktopLoginResponseDto, startDesktopLoginSchema } from './dtos/start-desktop.dto.js'
import { AuthService } from './services/auth.service.js'

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
	constructor(private authService: AuthService) {}

	@Public()
	@Post('desktop/start')
	@HttpCode(200)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({
		summary: 'Create a five-minute login; open authorizationUrl in the system browser',
	})
	@ApiResponse({ status: 200, type: StartDesktopLoginResponseDto })
	@ApiResponse({ status: 400, type: ApiErrorResponseDto })
	startGoogleOAuth(@Body(new ZodValidationPipe(startDesktopLoginSchema)) body: StartDesktopLoginDto) {
		const { codeChallenge } = body

		return this.authService.startDesktopLogin(codeChallenge)
	}

	@Public()
	@Get('google/callback')
	@HttpCode(200)
	@Header('Content-Type', 'text/html; charset=utf-8')
	@Header('Cache-Control', 'no-store')
	@Header('Referrer-Policy', 'no-referrer')
	@ApiOperation({
		summary: 'Google redirect URI; completes the ticket without exposing tokens in the browser',
	})
	@ApiResponse({ status: 200, description: 'HTML instructing the user to return to Teamdrop' })
	@ApiResponse({ status: 400, description: 'Malformed callback' })
	@ApiResponse({ status: 401, description: 'Invalid, expired or already consumed OAuth state' })
	async authenticateWithGoogle(
		@Query(new ZodValidationPipe(googleCallbackQuerySchema)) query: GoogleCallbackQueryDto
	) {
		const { state, code, error } = query

		const success = await this.authService.completeGoogleLogin(state, code, error)

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
	@ApiExtraModels(
		ExchangePendingResponseDto,
		ExchangeCompleteResponseDto,
		)
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
		description: 'Invalid, expired, denied or already consumed ticket; incorrect verifier',
	})
	exchange(@Body(new ZodValidationPipe(exchangeDesktopSchema, 'Invalid desktop exchange')) body: ExchangeDesktopDto) {
		const { ticket, codeVerifier } = body

		return this.authService.exchangeDesktopLogin(ticket, codeVerifier)
	}

	@Public()
	@Post('refresh')
	@HttpCode(200)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Rotate the refresh token; session expiration is never extended' })
	@ApiResponse({ status: 200, type: RefreshTokenResponseDto })
	@ApiResponse({ status: 400, description: 'Malformed refresh token' })
	@ApiResponse({
		status: 401,
		description: 'INVALID_REFRESH_TOKEN: unknown, expired or already rotated refresh token',
	})
	refresh(@Body(new ZodValidationPipe(refreshTokenSchema, 'Invalid refresh token format')) body: RefreshTokenDto) {
		return this.authService.refresh(body.refreshToken)
	}

	@Public()
	@Post('logout')
	@HttpCode(204)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({
		summary: 'Revoke this session using its current refresh token; repeated calls succeed',
	})
	@ApiResponse({
		status: 204,
		description:
			'Session removed or refresh token already invalid; issued JWTs remain valid until expiration',
	})
	@ApiResponse({ status: 400, description: 'Malformed refresh token' })
	logout(@Body(new ZodValidationPipe(refreshTokenSchema, 'Invalid refresh token format')) body: RefreshTokenDto) {
		return this.authService.logout(body.refreshToken)
	}
}
