import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { FilesService } from '../application/files.service.js'

@Injectable()
export class CleanupExpiredFilesJob {
	constructor(private readonly filesService: FilesService) {}

	@Cron(CronExpression.EVERY_5_MINUTES, {
		name: 'cleanup-expired-files',
		waitForCompletion: true,
	})
	async execute() {
		await this.filesService.cleanupExpiredFiles()
	}
}
