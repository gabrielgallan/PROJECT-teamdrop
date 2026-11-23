import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'
import { PrismaService } from '../../database/prisma/prisma.service.js'
import { StorageService } from '../../storage/storage.interface.js'
import { UploadFileServiceDto } from './dtos/upload-file.dto.js'

@Injectable()
export class FilesService {
	constructor(
		private prisma: PrismaService,
		private storageService: StorageService,
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
				message: 'Resource not found',
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

		return {
			file,
		}
	}
}
