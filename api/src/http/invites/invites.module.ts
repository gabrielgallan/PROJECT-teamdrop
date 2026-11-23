import { Module } from '@nestjs/common'
import { CryptographyModule } from '../../cryptography/cryptography.module.js'
import { DatabaseModule } from '../../database/database.module.js'
import { EnvModule } from '../../env/env.module.js'
import { InvitePageController } from './invite-page.controller.js'
import { InvitesController } from './invites.controller.js'
import { InvitesService } from './invites.service.js'

@Module({
	imports: [EnvModule, DatabaseModule, CryptographyModule],
	controllers: [InvitesController, InvitePageController],
	providers: [InvitesService],
})
export class InvitesModule {}
