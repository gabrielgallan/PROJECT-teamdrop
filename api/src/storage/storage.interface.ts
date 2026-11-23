import { Injectable } from '@nestjs/common'

export type StorageUrlType = 'download' | 'preview'

@Injectable()
export abstract class StorageService {
	abstract upload(key: string, data: Buffer, mimeType: string): Promise<void>

	abstract generateUrl(key: string, type: StorageUrlType, fileName?: string): Promise<{ url: string }>
	
	abstract delete(key: string): Promise<void>
}
