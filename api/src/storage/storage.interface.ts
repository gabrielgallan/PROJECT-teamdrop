export abstract class StorageService {
	abstract upload(key: string, data: Buffer, mimeType: string): Promise<void>

	abstract download(key: string): Promise<NodeJS.ReadableStream>

	abstract delete(key: string): Promise<void>
}
