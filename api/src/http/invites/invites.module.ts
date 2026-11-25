import { Module } from '@nestjs/common'
import { CryptographyModule } from '../../common/cryptography/cryptography.module.js'
import { EnvModule } from '../../common/env/env.module.js'
import { DatabaseModule } from '../../database/database.module.js'
import { InvitesService } from './application/invites.service.js'
import { InvitePageController } from './presentation/invite-page.controller.js'
import { InvitesController } from './presentation/invites.controller.js'

@Module({
	imports: [EnvModule, DatabaseModule, CryptographyModule],
	controllers: [InvitesController, InvitePageController],
	providers: [InvitesService],
})
export class InvitesModule {}
