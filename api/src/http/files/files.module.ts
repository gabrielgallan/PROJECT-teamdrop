import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module.js'
import { EnvModule } from '../../env/env.module.js'
import { StorageModule } from '../../storage/storage.module.js'
import { FilesController } from './files.controller.js'
import { FilesService } from './files.service.js'

@Module({
	imports: [EnvModule, StorageModule, DatabaseModule],
	controllers: [FilesController],
	providers: [FilesService],
})
export class FilesModule {}
