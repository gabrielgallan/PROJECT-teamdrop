import { File, Prisma } from '../../../database/prisma/client/client.js'

export type PrismaFileWithAuthor = Prisma.FileGetPayload<{
	include: {
		author: {
			select: {
				name: true,
				email: true,
				avatarUrl: true
			}
		}
	}
}>

export class FilesPresenter {
  static toHTTP(file: File) {
    const {
      authorId,
      teamId,
      storageKey,
      ...data
    } = file

    return {
      ...data,
      size: Number(file.size),
    }
  }

  static fileWithAuthorToHTTP(fileWithAuthor: PrismaFileWithAuthor) {
    const {
        authorId,
        teamId,
        storageKey,
        ...data
      } = fileWithAuthor

      return {
        ...data,
        size: Number(fileWithAuthor.size),
      }
  }
}