import {
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js'
import {
	IStorageService,
	StorageService,
} from '../../../infrastructure/storage/storage.interface.js'
import { FilesEmitterService } from '../../../infrastructure/websocket/events/files/files-emitter.service.js'
import {
	DeleteFileServiceInput,
	GenerateFileUrlServiceInput,
	ListFilesServiceInput,
	UploadFileServiceInput,
} from './files.types.js'

@Injectable()
export class FilesService {
	private logger = new Logger(this.constructor.name)

	constructor(
		private prisma: PrismaService,
		@Inject(StorageService)
		private storageService: IStorageService,
		private filesEmitterService: FilesEmitterService,
	) {}

	async uploadFile({
		userId,
		teamId,
		fileName,
		fileData,
		fileMimeType,
		fileSize,
	}: UploadFileServiceInput) {
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
				team: {
					select: {
						storageRetentionSeconds: true,
					},
				},
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

		const expiresAt = new Date(
			Date.now() + membership.team.storageRetentionSeconds * 1000,
		)

		const file = await this.prisma.file.create({
			data: {
				id: fileId,
				teamId: membership.teamId,
				authorId: membership.userId,
				name: fileName,
				mimeType: fileMimeType,
				size: fileSize,
				storageKey,
				expiresAt,
			},
		})

		this.filesEmitterService.fileUploaded(file.teamId, file.id)

		return {
			file,
		}
	}

	async listFiles({
		userId,
		teamId,
		cursor,
		limit = 10,
	}: ListFilesServiceInput) {
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
				expiresAt: {
					gt: new Date(),
				},
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

	async generateFileUrl({
		userId,
		fileId,
		urlType,
	}: GenerateFileUrlServiceInput) {
		const file = await this.prisma.file.findUnique({
			where: {
				id: fileId,
				team: {
					members: {
						some: {
							userId,
						},
					},
				},
			},
		})

		if (!file || file.expiresAt <= new Date()) {
			throw new NotFoundException({
				message: 'File not found or expired',
			})
		}

		const { url } = await this.storageService.generateUrl(
			file.storageKey,
			urlType,
			file.name,
		)

		return {
			url,
		}
	}

	async deleteFile({ userId, teamId, fileId }: DeleteFileServiceInput) {
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

	async cleanupExpiredFiles() {
		const batchSize = 100
		const concurrency = 5
		const expiredBefore = new Date()
		const startedAt = Date.now()

		let cursor: string | undefined
		let totalDeleted = 0
		let totalFailed = 0

		while (true) {
			const files = await this.prisma.file.findMany({
				where: {
					expiresAt: {
						lte: expiredBefore,
					},
					...(cursor && {
						id: {
							gt: cursor,
						},
					}),
				},
				select: {
					id: true,
					storageKey: true,
				},
				orderBy: {
					id: 'asc',
				},
				take: batchSize,
			})

			if (!files.length) break

			const deletedFileIds: string[] = []

			for (let i = 0; i < files.length; i += concurrency) {
				const chunk = files.slice(i, i + concurrency)

				const results = await Promise.allSettled(
					chunk.map(async (file) => {
						await this.storageService.delete(file.storageKey)

						return file.id
					}),
				)

				for (const result of results) {
					if (result.status === 'fulfilled') {
						deletedFileIds.push(result.value)
					} else {
						totalFailed++

						this.logger.error('Failed to delete expired file', result.reason)
					}
				}
			}

			if (deletedFileIds.length) {
				const { count } = await this.prisma.file.deleteMany({
					where: {
						id: {
							in: deletedFileIds,
						},
					},
				})

				totalDeleted += count
			}

			cursor = files[files.length - 1]?.id

			if (files.length < batchSize) break
		}

		this.logger.log(
			`Expired files cleanup completed: ${totalDeleted} deleted, ${totalFailed} failed (${Date.now() - startedAt}ms)`,
		)
	}
}
