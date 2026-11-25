import { Module } from '@nestjs/common'
import { EnvModule } from '../../common/env/env.module.js'
import { DatabaseModule } from '../../database/database.module.js'
import { StorageModule } from '../../storage/storage.module.js'
import { WebSocketModule } from '../../websocket/websocket.module.js'
import { FilesService } from './files.service.js'
import { FilesController } from './presentation/files.controller.js'

@Module({
	imports: [EnvModule, StorageModule, DatabaseModule, WebSocketModule],
	controllers: [FilesController],
	providers: [FilesService],
})
export class FilesModule {}
