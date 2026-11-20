import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module.js'
import { UsersService } from './users.service.js'

@Module({
	imports: [DatabaseModule],
	exports: [UsersService],
	providers: [UsersService],
})
export class UsersModule {}
