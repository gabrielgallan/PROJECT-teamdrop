import { MiddlewareConsumer, Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { StorageModule } from '../storage/storage.module.js'
import { HealthModule } from './health/health.module.js'
import { InvitesModule } from './invites/invites.module.js'
import { LoggingMiddleware } from './middlewares/logging/logging.middleware.js'
import { TeamsModule } from './teams/teams.module.js'
import { UsersModule } from './users/users.module.js'

@Module({
	imports: [StorageModule, DatabaseModule, HealthModule, UsersModule, TeamsModule, InvitesModule],
})
export class HttpMoodule {
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(LoggingMiddleware).forRoutes('/api')
	}
}
