import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import {
	AuthenticatedRequest,
	AuthenticatedUser,
} from '../services/auth.service.js'

export const CurrentUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext): AuthenticatedUser =>
		context.switchToHttp().getRequest<AuthenticatedRequest>().user,
)
