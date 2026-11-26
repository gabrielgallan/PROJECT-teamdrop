import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export class CreateTeamDto extends createZodDto(
	z.object({
		name: z.string().trim().nonempty(),
		storageRetentionSeconds: z
			.number()
			.int()
			.min(900)
			.max(259200)
			.default(86400),
	}),
) {}
