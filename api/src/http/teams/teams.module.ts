import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module.js'
import { TeamsController } from './teams.controller.js'
import { TeamsService } from './teams.service.js'

@Module({
	imports: [DatabaseModule],
	controllers: [TeamsController],
	providers: [TeamsService],
})
export class TeamsModule {}
