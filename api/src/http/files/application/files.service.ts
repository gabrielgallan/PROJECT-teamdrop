import {
	BadGatewayException,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'
import { PrismaService } from '../../database/prisma/prisma.service.js'
import { StorageService } from '../../storage/storage.interface.js'
import { FilesEmitterService } from '../../websocket/events/files/files-emitter.service.js'
import { DeleteFileServiceDto } from './dtos/delete-file.dto.js'
import { ListFilesServiceDto } from './dtos/list-files.dto.js'
import { UploadFileServiceDto } from './dtos/upload-file.dto.js'

@Injectable()
export class FilesService {
	constructor(
		private prisma: PrismaService,
		private storageService: StorageService,
		private filesEmitterService: FilesEmitterService,
	) {}

	async uploadFile({
		userId,
		teamId,
		fileName,
		fileData,
		fileMimeType,
		fileSize,
	}: UploadFileServiceDto) {
		const membership = await this.prisma.member.findUnique({
			where: {
				teamId_userId: {
					teamId,
					userId,
				},
			},
			select: {
				teamId: true,
				userId: true,
			},
		})

		if (!membership) {
			throw new NotFoundException({
				message: 'User membership not found',
			})
		}

		const fileId = uuidv7()
		const storageKey = `teams/${membership.teamId}/${fileId}`

		try {
			await this.storageService.upload(storageKey, fileData, fileMimeType)
		} catch (err) {
			throw new ServiceUnavailableException({
				message: 'File storage service is unavailable',
			})
		}

		const file = await this.prisma.file.create({
			data: {
				id: fileId,
				teamId: membership.teamId,
				authorId: membership.userId,
				name: fileName,
				mimeType: fileMimeType,
				size: fileSize,
				storageKey,
			},
		})

		this.filesEmitterService.fileUploaded(file.teamId, file.id)

		return {
			file,
		}
	}

	async listFiles({ userId, teamId, cursor, limit = 10 }: ListFilesServiceDto) {
		const membership = await this.prisma.member.findUnique({
			where: {
				teamId_userId: {
					teamId,
					userId,
				},
			},
			select: {
				teamId: true,
				userId: true,
			},
		})

		if (!membership) {
			throw new NotFoundException({
				message: 'User membership not found',
			})
		}

		const files = await this.prisma.file.findMany({
			where: {
				teamId,
				...(cursor && {
					id: {
						lt: cursor,
					},
				}),
			},
			orderBy: {
				id: 'desc',
			},
			take: limit + 1,
			include: {
				author: {
					select: {
						name: true,
						email: true,
						avatarUrl: true,
					},
				},
			},
		})

		const hasNextPage = files.length > limit

		if (hasNextPage) {
			files.pop()
		}

		return {
			files,
			nextCursor: hasNextPage ? files.at(-1)?.id : null,
		}
	}

	async getFileDownloadUrl(fileId: string) {
		const file = await this.prisma.file.findUnique({
			where: {
				id: fileId,
			},
		})

		if (!file) {
			throw new NotFoundException({
				message: 'File not found',
			})
		}

		const { url } = await this.storageService.generateUrl(file.storageKey, 'download', file.name)

		return {
			url,
		}
	}

	async getFilePreviewUrl(fileId: string) {
		const file = await this.prisma.file.findUnique({
			where: {
				id: fileId,
			},
		})

		if (!file) {
			throw new NotFoundException({
				message: 'File not found',
			})
		}

		const { url } = await this.storageService.generateUrl(file.storageKey, 'preview')

		return {
			url,
		}
	}

	async deleteFile({ userId, teamId, fileId }: DeleteFileServiceDto) {
		const file = await this.prisma.file.findUnique({
			where: {
				id: fileId,
				authorId: userId,
				teamId,
			},
		})

		if (!file) {
			throw new NotFoundException({
				message: 'File not found',
			})
		}

		try {
			await this.storageService.delete(file.storageKey)
		} catch {
			throw new ServiceUnavailableException({
				message: 'File storage service is unavailable',
			})
		}

		await this.prisma.file.delete({
			where: {
				id: fileId,
			},
		})

		this.filesEmitterService.fileDeleted(file.teamId, file.id)

		return
	}
}
