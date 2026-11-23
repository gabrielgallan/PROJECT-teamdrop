import { createZodDto } from "nestjs-zod"
import z from "zod"

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
