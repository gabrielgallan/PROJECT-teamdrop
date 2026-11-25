import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../infrastructure/database/database.module.js'
import { TeamsService } from './application/teams.service.js'
import { TeamsController } from './presentation/teams.controller.js'

@Module({
	imports: [DatabaseModule],
	controllers: [TeamsController],
	providers: [TeamsService],
})
export class TeamsModule {}
