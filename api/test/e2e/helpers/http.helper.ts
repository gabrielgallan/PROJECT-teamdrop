import { INestApplication } from '@nestjs/common'
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler'

export const httpHelper = {
	resetRateLimits,
}

function resetRateLimits(app: INestApplication) {
	// Clear counters and timers so each test starts with the real limits available.
	app.get<ThrottlerStorageService>(ThrottlerStorage).onApplicationShutdown()
}
