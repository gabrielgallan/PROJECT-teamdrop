export type StorageUrlType = 'download' | 'preview'

export interface IStorageService {
	upload(key: string, data: Buffer, mimeType: string): Promise<void>

	generateUrl(
		key: string,
		type: StorageUrlType,
		fileName?: string,
	): Promise<{ url: string }>

	delete(key: string): Promise<void>
}

export const StorageService = Symbol.for('storage:IStorageService')
