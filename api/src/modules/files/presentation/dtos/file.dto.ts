import { ApiProperty } from '@nestjs/swagger'

export class PublicFileDto {
	@ApiProperty({
		example: 'a7cd927d-de92-4af8-b16c-797bb1ec1641',
	})
	id!: string

	@ApiProperty({
		example: 'document.pdf',
	})
	name!: string

	@ApiProperty({
		example: 1048576,
		description: 'File size in bytes.',
	})
	size!: number

	@ApiProperty({
		example: 'application/pdf',
	})
	mimeType!: string

	@ApiProperty({
		example: '2026-11-24T14:20:00.000Z',
		type: String,
		format: 'date-time',
	})
	createdAt!: Date

	@ApiProperty({
		example: '2026-11-27T12:00:00.000Z',
		type: String,
		format: 'date-time',
		description: 'Date when the file expires',
	})
	expiresAt!: Date
}
