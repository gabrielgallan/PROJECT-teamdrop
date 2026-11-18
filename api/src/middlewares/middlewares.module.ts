import { Module } from '@nestjs/common'
import { LoggingMiddleware } from './logging/logging.middleware.js'

@Module({
	imports: [],
	providers: [LoggingMiddleware],
})
export class MiddlewaresModule {}
