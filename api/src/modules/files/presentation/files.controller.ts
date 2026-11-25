import {
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	Post,
	Query,
	Res,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger'
import { Response } from 'express'
import { createZodDto } from 'nestjs-zod'
import z from 'zod'
import { ApiErrorResponseDto } from '../../../common/http/dtos/api-error-response.dto.js'
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator.js'
import { Public } from '../../auth/presentation/decorators/public.decorator.js'
import { AuthenticatedUser } from '../../auth/services/auth.service.js'
import { TeamIdDto } from '../../teams/presentation/teams.controller.js'
import { FilesService } from '../application/files.service.js'
import { DeleteFileDto } from './dtos/delete-file.dto.js'
import { PublicFileDto } from './dtos/file.dto.js'
import { GenerateFileUrlResponseDto } from './dtos/generate-url.dto.js'
import { ListFilesDto, ListFilesResponseDto } from './dtos/list-files.dto.js'
import { FilesPresenter } from './files.presenter.js'

class FileIdDto extends createZodDto(
	z.object({
		fileId: z.uuid(),
	}),
) {}

@ApiTags('Files')
@Controller('api')
export class FilesController {
	constructor(private readonly filesService: FilesService) {}

	// Upload file
	@ApiOperation({
		summary: 'Upload team file',
	})
	@ApiResponse({
		status: 201,
		description: 'File uploaded successfully.',
		type: PublicFileDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Data validation failed.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 401,
		description: 'Authentication required or invalid access token.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 404,
		description:
			'Resource not found or inaccessible to the authenticated user.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 503,
		description: 'File storage service is unavailable.',
		type: ApiErrorResponseDto,
	})
	@ApiBearerAuth()
	@Post('teams/:teamId/files')
	@HttpCode(201)
	@UseInterceptors(FileInterceptor('file'))
	async uploadFile(
		@CurrentUser() user: AuthenticatedUser,
		@Param() param: TeamIdDto,
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

		return FilesPresenter.toHTTP(result.file)
	}

	// List files
	@ApiOperation({
		summary: 'List team files',
	})
	@ApiResponse({
		status: 200,
		description: 'File list retrived successfully.',
		type: ListFilesResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Data validation failed.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 401,
		description: 'Authentication required or invalid access token.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 404,
		description:
			'Resource not found or inaccessible to the authenticated user.',
		type: ApiErrorResponseDto,
	})
	@ApiBearerAuth()
	@Get('teams/:teamId/files')
	@HttpCode(200)
	async listFiles(
		@CurrentUser() user: AuthenticatedUser,
		@Param() param: TeamIdDto,
		@Query() query: ListFilesDto,
	) {
		const { teamId } = param
		const { limit, cursor } = query

		const { files, nextCursor } = await this.filesService.listFiles({
			userId: user.userId,
			teamId,
			limit,
			cursor,
		})

		return {
			files: files.map(FilesPresenter.fileWithAuthorToHTTP),
			nextCursor,
		}
	}

	// Preview file
	@ApiOperation({
		summary: 'Preview file',
	})
	@ApiResponse({
		status: 302,
		description: 'Redirects to the file preview URL.',
	})
	@ApiResponse({
		status: 400,
		description: 'Data validation failed.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 404,
		description:
			'Resource not found or inaccessible to the authenticated user.',
		type: ApiErrorResponseDto,
	})
	@Public()
	@Get('files/:fileId/preview')
	@HttpCode(302)
	async previewFile(@Param() param: FileIdDto, @Res() response: Response) {
		const { url } = await this.filesService.getFilePreviewUrl(param.fileId)

		return response.redirect(url)
	}

	// Download file
	@ApiOperation({
		summary: 'Download file',
	})
	@ApiResponse({
		status: 302,
		description: 'Redirects to the file download URL.',
	})
	@ApiResponse({
		status: 400,
		description: 'Data validation failed.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 404,
		description:
			'Resource not found or inaccessible to the authenticated user.',
		type: ApiErrorResponseDto,
	})
	@Public()
	@Get('files/:fileId/download')
	@HttpCode(302)
	async downloadFile(@Param() param: FileIdDto, @Res() response: Response) {
		const { url } = await this.filesService.getFileDownloadUrl(param.fileId)

		return response.redirect(url)
	}

	// Get file URL
	@ApiOperation({
		summary: 'Get file URL',
	})
	@ApiResponse({
		status: 200,
		description: 'File URL retrieved successfully.',
		type: GenerateFileUrlResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Data validation failed.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 404,
		description:
			'Resource not found or inaccessible to the authenticated user.',
		type: ApiErrorResponseDto,
	})
	@Public()
	@Get('files/:fileId/url')
	@HttpCode(200)
	async generateUrl(@Param() param: FileIdDto) {
		const { url } = await this.filesService.getFilePreviewUrl(param.fileId)

		return {
			url,
		}
	}

	// Delete file
	@ApiOperation({
		summary: 'Delete team file',
	})
	@ApiResponse({
		status: 204,
		description: 'File successfully deleted.',
	})
	@ApiResponse({
		status: 400,
		description: 'Data validation failed.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 401,
		description: 'Authentication required or invalid access token.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 404,
		description:
			'Resource not found or inaccessible to the authenticated user.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 503,
		description: 'File storage service is unavailable.',
		type: ApiErrorResponseDto,
	})
	@ApiBearerAuth()
	@Delete('teams/:teamId/files/:fileId')
	@HttpCode(204)
	async deleteFile(
		@CurrentUser() user: AuthenticatedUser,
		@Param() param: DeleteFileDto,
	) {
		await this.filesService.deleteFile({
			userId: user.userId,
			teamId: param.teamId,
			fileId: param.fileId,
		})

		return
	}
}
