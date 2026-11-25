import {
	BlobSASPermissions,
	BlobServiceClient,
	type ContainerClient,
} from '@azure/storage-blob'
import { Injectable, Logger } from '@nestjs/common'
import { EnvService } from '../../common/env/env.service.js'
import { StorageService, StorageUrlType } from '../storage.interface.js'

@Injectable()
export class AzureStorageService implements StorageService {
	private readonly container: ContainerClient
	private readonly logger = new Logger(AzureStorageService.name)

	constructor(private readonly env: EnvService) {
		const connectionString = this.env.get('AZURE_STORAGE_CONNECTION_STRING')
		const containerName = this.env.get('AZURE_STORAGE_CONTAINER')

		if (!connectionString || !containerName) {
			this.logger.error('Azure Storage configuration is missing')
			throw new Error('Azure Storage configuration is missing')
		}

		const client = BlobServiceClient.fromConnectionString(connectionString)

		this.container = client.getContainerClient(containerName)

		this.logger.log(`Azure Blob Storage initialized: ${containerName}`)
	}

	async upload(key: string, data: Buffer, mimeType: string) {
		const startedAt = performance.now()

		try {
			const blob = this.container.getBlockBlobClient(key)

			await blob.uploadData(data, {
				blobHTTPHeaders: {
					blobContentType: mimeType,
				},
			})

			const duration = Math.round(performance.now() - startedAt)

			this.logger.log(
				`Blob uploaded: ${key} (${data.byteLength} bytes, ${duration}ms)`,
			)
		} catch (error) {
			this.logger.error(`Failed to upload blob: ${key}`, error)
			throw error
		}
	}

	async generateUrl(
		key: string,
		type: StorageUrlType = 'preview',
		fileName?: string,
	) {
		try {
			const blob = this.container.getBlockBlobClient(key)

			const url = await blob.generateSasUrl({
				permissions: BlobSASPermissions.parse('r'),
				expiresOn: new Date(Date.now() + 5 * 60 * 1000),
				contentDisposition:
					type === 'download'
						? `attachment; filename*=UTF-8''${encodeURIComponent(String(fileName))}`
						: undefined,
				contentType:
					type === 'download' ? 'application/octet-stream' : undefined,
			})

			this.logger.log(`Blob ${type} URL generated: ${key}`)

			return {
				url,
			}
		} catch (error) {
			this.logger.error(`Failed to generate blob ${type} URL: ${key}`, error)

			throw error
		}
	}

	async delete(key: string) {
		try {
			const blob = this.container.getBlockBlobClient(key)

			const response = await blob.deleteIfExists({
				deleteSnapshots: 'include',
			})

			if (response.succeeded) {
				this.logger.log(`Blob deleted: ${key}`)
			} else {
				this.logger.warn(`Blob not found for deletion: ${key}`)
			}
		} catch (error) {
			this.logger.error(`Failed to delete blob: ${key}`, error)

			throw error
		}
	}
}
