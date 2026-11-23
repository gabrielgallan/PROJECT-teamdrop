import { Controller, Delete, Get, HttpCode, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { AuthenticatedUser } from '../../auth/services/auth.service.js'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js'
import { TeamIdDto, teamIdSchema } from '../teams/teams.controller.js'
import { FilesService } from './files.service.js'
import { FilesPresenter } from './presenters/files.presenter.js'
import { Public } from '../../auth/decorators/public.decorator.js'
import { Response } from 'express';
import z from 'zod'
import { createZodDto } from 'nestjs-zod'
import { DeleteFileDto, deleteFileSchema } from './dtos/delete-file.dto.js'
import { ListFilesDto, listFilesSchema } from './dtos/list-files.dto.js'

const fileIdSchema = z.object({
	fileId: z.uuid()
})

class FileIdDto extends createZodDto(fileIdSchema) {}

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

		return {
			file: FilesPresenter.toHTTP(result.file)
		}
	}

	@Get('teams/:teamId/files')
	@HttpCode(200)
	async listFiles(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(teamIdSchema)) param: TeamIdDto,
		@Query(new ZodValidationPipe(listFilesSchema)) query: ListFilesDto
	) {
		const { teamId } = param
		const { limit, cursor } = query

		const { files, nextCursor } = await this.filesService.listFiles({
			userId: user.userId,
			teamId,
			limit,
			cursor
		})

		return {
			files: files.map(FilesPresenter.fileWithAuthorToHTTP),
			nextCursor
		}
	}

	@Public()
	@Get('files/:fileId/preview')
	@HttpCode(302)
	async previewFile(
		@Param(new ZodValidationPipe(fileIdSchema)) param: FileIdDto,
		@Res() response: Response
	) {
		const { url } = await this.filesService.getFilePreviewUrl(param.fileId)

		return response.redirect(url)
	}

	@Public()
	@Get('files/:fileId/download')
	@HttpCode(302)
	async downloadFile(
		@Param(new ZodValidationPipe(fileIdSchema)) param: FileIdDto,
		@Res() response: Response
	) {
		const { url } = await this.filesService.getFileDownloadUrl(param.fileId)

		return response.redirect(url)
	}

	@Public()
	@Get('files/:fileId/url')
	@HttpCode(200)
	async generateUrl(
		@Param(new ZodValidationPipe(fileIdSchema)) param: FileIdDto,
	) {
		const { url } = await this.filesService.getFilePreviewUrl(param.fileId)

		return {
			url,
		}
	}

	@Delete('teams/:teamId/files/:fileId')
	@HttpCode(204)
	async deleteFile(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(deleteFileSchema)) param: DeleteFileDto,
	) {
		await this.filesService.deleteFile({
			userId: user.userId,
			teamId: param.teamId,
			fileId: param.fileId,
		})

		return
	}
}
