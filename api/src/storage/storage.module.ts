import { Module } from '@nestjs/common'
import { EnvModule } from '../env/env.module.js'
import { AzureStorageService } from './azure/azure-storage.service.js'
import { StorageService } from './storage.interface.js'

@Module({
	imports: [EnvModule],
	exports: [StorageService],
	providers: [
		{
			provide: StorageService,
			useClass: AzureStorageService,
		},
	],
})
export class StorageModule {}
