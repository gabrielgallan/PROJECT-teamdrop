import { Controller, HttpCode, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { AuthenticatedUser } from '../../auth/services/auth.service.js'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js'
import { TeamIdDto, teamIdSchema } from '../teams/teams.controller.js'
import { FilesService } from './files.service.js'
import { FilesMapper } from './mappers/files.mapper.js'

@ApiTags('Files')
@Controller('api')
export class FilesController {
	constructor(private readonly filesService: FilesService) {}

	@Post('teams/:teamId/files')
	@HttpCode(201)
	@UseInterceptors(FileInterceptor('file'))
	async uploadFile(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(teamIdSchema)) param: TeamIdDto,
		@UploadedFile() file: Express.Multer.File,
	) {
		const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8')

		const { teamId } = param

		const result = await this.filesService.uploadFile({
			userId: user.userId,
			teamId,
			fileName,
			fileData: file.buffer,
			fileMimeType: file.mimetype,
			fileSize: file.size,
		})

		return FilesMapper.toHTTP(result.file)
	}

	// @Get('download/*path')
	// async download(@Param('path') path: string[], @Res() response: Response) {
	// 	const key = path.join('/')
	// 	const stream = await this.storage.download(key)

	// 	response.setHeader('Content-Type', 'application/octet-stream')
	// 	response.setHeader('Content-Disposition', 'attachment')

	// 	stream.pipe(response)
	// }

	// @Get('url/*path')
	// async getDownloadUrl(@Param('path') path: string[]) {
	// 	const key = path.join('/')
	// 	const url = await this.storage.getDownloadUrl(key)

	// 	return { url }
	// }

	// @Delete('*path')
	// async delete(@Param('path') path: string[]) {
	// 	const key = path.join('/')

	// 	await this.storage.delete(key)

	// 	return { message: 'File deleted successfully' }
	// }
}
