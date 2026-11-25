import {
	type ExecutionContext,
	HttpException,
	HttpStatus,
	Injectable,
} from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (context.getType() !== 'http') {
			return true
		}

		return super.canActivate(context)
	}

	protected async throwThrottlingException(): Promise<void> {
		throw new HttpException(
			{
				message: 'Too many requests',
			},
			HttpStatus.TOO_MANY_REQUESTS,
		)
	}
}
