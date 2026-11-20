import { Module } from '@nestjs/common'
import { CryptographyModule } from '../../cryptography/cryptography.module.js'
import { DatabaseModule } from '../../database/database.module.js'
import { UsersModule } from '../users/users.module.js'
import { InvitesController } from './invites.controller.js'
import { InvitesService } from './invites.service.js'

@Module({
	imports: [DatabaseModule, UsersModule, CryptographyModule],
	controllers: [InvitesController],
	providers: [InvitesService],
})
export class InvitesModule {}
