import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export const deleteFileSchema = z.object({
	teamId: z.string(),
	fileId: z.string(),
})

export class DeleteFileDto extends createZodDto(deleteFileSchema) {}

export interface DeleteFileServiceDto {
	userId: string
	teamId: string
	fileId: string
}
