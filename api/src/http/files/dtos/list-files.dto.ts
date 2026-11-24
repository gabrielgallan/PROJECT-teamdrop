import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { createZodDto } from "nestjs-zod"
import z from "zod"
import { PublicFileDto } from "./file.dto.js"

export const listFilesSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(10),
    cursor: z.uuidv7().optional()
})

export class ListFilesDto extends createZodDto(listFilesSchema) {}

export interface ListFilesServiceDto {
	userId: string
	teamId: string
    cursor?: string
    limit?: number
}

export class FileAuthorDto {
	@ApiProperty({
		type: String,
		nullable: true,
		example: 'John Doe',
	})
	name!: string | null

	@ApiProperty({
		example: 'john@example.com',
		format: 'email',
	})
	email!: string

	@ApiProperty({
		type: String,
		nullable: true,
		example: 'https://example.com/avatar.png',
	})
	avatarUrl!: string | null
}

export class FileWithAuthorDto extends PublicFileDto {
	@ApiProperty({
		type: FileAuthorDto,
	})
	author!: FileAuthorDto
}

export class ListFilesResponseDto {
	@ApiProperty({
		type: [FileWithAuthorDto],
	})
	files!: FileWithAuthorDto[]

	@ApiPropertyOptional({
		type: String,
		nullable: true,
		example: '01a2089f-6e56-778e-8ea2-889fced71309',
		description: 'Cursor used to retrieve the next page of files.',
	})
	nextCursor?: string | null
}
