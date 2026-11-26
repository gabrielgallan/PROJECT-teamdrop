import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../infrastructure/database/database.module.js'
import { EnvModule } from '../../infrastructure/env/env.module.js'
import { StorageModule } from '../../infrastructure/storage/storage.module.js'
import { WebSocketModule } from '../../infrastructure/websocket/websocket.module.js'
import { FilesService } from './application/files.service.js'
import { CleanupExpiredFilesJob } from './jobs/cleanup-expired-files.job.js'
import { FilesController } from './presentation/files.controller.js'

@Module({
	imports: [EnvModule, StorageModule, DatabaseModule, WebSocketModule],
	controllers: [FilesController],
	providers: [FilesService, CleanupExpiredFilesJob],
})
export class FilesModule {}
