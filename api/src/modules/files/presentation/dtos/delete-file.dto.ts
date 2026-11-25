import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export class DeleteFileDto extends createZodDto(
	z.object({
		teamId: z.string(),
		fileId: z.string(),
	}),
) {}
