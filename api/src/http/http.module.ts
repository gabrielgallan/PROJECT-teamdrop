import { MiddlewareConsumer, Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { HealthModule } from "./health/health.module.js";
import { LoggingMiddleware } from "./middlewares/logging/logging.middleware.js";
import { UsersModule } from "./users/users.module.js";
import { TeamsModule } from "./teams/teams.module.js";

@Module({
    imports: [
		StorageModule,
        DatabaseModule,
        HealthModule,
        UsersModule,
        TeamsModule
    ],
    controllers: [],
    providers: [],
})
export class HttpMoodule {
    configure(consumer: MiddlewareConsumer): void {
		consumer.apply(LoggingMiddleware).forRoutes('/api')
	}
}