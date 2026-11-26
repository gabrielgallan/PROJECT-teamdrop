import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export class UpdateTeamDto extends createZodDto(
	z.object({
		name: z.string().trim().nonempty().optional(),
		storageRetentionSeconds: z.number().int().min(900).max(259200).optional(),
	}),
) {}
