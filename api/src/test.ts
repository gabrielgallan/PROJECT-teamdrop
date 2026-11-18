import 'dotenv/config'

import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { BlobServiceClient } from '@azure/storage-blob'

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!

const containerName = process.env.AZURE_STORAGE_CONTAINER!

async function main() {
	const client = BlobServiceClient.fromConnectionString(connectionString)

	const container = client.getContainerClient(containerName)

	// Arquivo de teste
	const content = Buffer.from('Hello from TeamDrop!')
	const blobName = `tests/${randomUUID()}.txt`

	const blob = container.getBlockBlobClient(blobName)

	// Upload
	await blob.uploadData(content, {
		blobHTTPHeaders: {
			blobContentType: 'text/plain',
		},
	})

	console.log('Upload realizado:', blobName)

	// Download
	const outputDir = join(process.cwd(), 'downloads')

	await mkdir(outputDir, { recursive: true })

	const outputPath = join(outputDir, 'test.txt')

	await blob.downloadToFile(outputPath)

	console.log('Download concluído:', outputPath)
}

main().catch(console.error)
