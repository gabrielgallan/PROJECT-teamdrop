import { File } from '../../../database/prisma/client/client.js'

export class FilesMapper {
	static toHTTP(file: File) {
		return {
			...file,
			size: Number(file.size),
			authorId: undefined,
			teamId: undefined,
			storageKey: undefined,
		}
	}
}
