import { StorageUrlType } from '../../../infrastructure/storage/storage.interface.js'

interface DeleteFileServiceInput {
	userId: string
	teamId: string
	fileId: string
}

interface ListFilesServiceInput {
	userId: string
	teamId: string
	cursor?: string
	limit?: number
}

interface UploadFileServiceInput {
	userId: string
	teamId: string
	fileName: string
	fileData: Buffer
	fileSize: number
	fileMimeType: string
}

interface GenerateFileUrlServiceInput {
	userId: string
	fileId: string
	urlType: StorageUrlType
}

export type {
	DeleteFileServiceInput,
	GenerateFileUrlServiceInput,
	ListFilesServiceInput,
	UploadFileServiceInput,
}
