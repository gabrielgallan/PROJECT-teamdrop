import {
	File,
	Prisma,
} from '../../../infrastructure/database/prisma/client/client.js'
import { PublicFileDto } from './dtos/file.dto.js'

export type PrismaFileWithAuthor = Prisma.FileGetPayload<{
	include: {
		author: {
			select: {
				name: true
				email: true
				avatarUrl: true
			}
		}
	}
}>

export class FilesPresenter {
	static toHTTP(file: File): PublicFileDto {
		const { authorId, teamId, storageKey, ...data } = file

		return {
			...data,
			size: Number(file.size),
		}
	}

	static fileWithAuthorToHTTP(fileWithAuthor: PrismaFileWithAuthor) {
		const { authorId, teamId, storageKey, ...data } = fileWithAuthor

		return {
			...data,
			size: Number(fileWithAuthor.size),
		}
	}
}
