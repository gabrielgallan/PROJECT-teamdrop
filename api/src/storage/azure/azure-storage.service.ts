import type { Readable } from 'node:stream'
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob'
import { Logger } from '@nestjs/common'

import { EnvService } from '../../env/env.service.js'
import { StorageService } from '../storage.interface.js'

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

	async upload(key: string, data: Buffer, mimeType: string): Promise<void> {
		const startedAt = performance.now()

		try {
			const blob = this.container.getBlockBlobClient(key)

			await blob.uploadData(data, {
				blobHTTPHeaders: {
					blobContentType: mimeType,
				},
			})

			const duration = Math.round(performance.now() - startedAt)

			this.logger.log(`Blob uploaded: ${key} (${data.byteLength} bytes, ${duration}ms)`)
		} catch (error) {
			this.logger.error(`Failed to upload blob: ${key}`, error)
			throw error
		}
	}

	async download(key: string): Promise<NodeJS.ReadableStream> {
		try {
			const blob = this.container.getBlockBlobClient(key)
			const response = await blob.download()

			if (!response.readableStreamBody) {
				throw new Error(`Unable to download blob: ${key}`)
			}

			this.logger.log(`Blob download started: ${key}`)

			return response.readableStreamBody as Readable
		} catch (error) {
			this.logger.error(`Failed to download blob: ${key}`, error)
			throw error
		}
	}

	async delete(key: string): Promise<void> {
		try {
			const blob = this.container.getBlockBlobClient(key)
			const response = await blob.deleteIfExists()

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
