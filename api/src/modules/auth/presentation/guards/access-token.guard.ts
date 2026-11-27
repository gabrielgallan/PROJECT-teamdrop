import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AccessTokenService } from '../../application/access-token.service.js'
import { AuthenticatedRequest } from '../../application/auth.types.js'
import { PUBLIC_ROUTE_KEY } from '../decorators/public.decorator.js'

@Injectable()
export class AccessTokenGuard implements CanActivate {
	constructor(
		private reflector: Reflector,
		private tokens: AccessTokenService,
	) {}

	async canActivate(context: ExecutionContext) {
		if (
			this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
				context.getHandler(),
				context.getClass(),
			])
		)
			return true

		const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
		const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? '')
		if (!match) {
			throw new UnauthorizedException({
				code: 'INVALID_ACCESS_TOKEN',
				message: 'Bearer access token required',
			})
		}
		request.user = await this.tokens.verify(match[1])
		return true
	}
}
