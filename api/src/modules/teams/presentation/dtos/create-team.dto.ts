import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export class CreateTeamDto extends createZodDto(
	z.object({
		name: z.string().trim().nonempty(),
	}),
) {}
