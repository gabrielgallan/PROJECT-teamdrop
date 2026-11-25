import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export class UpdateTeamDto extends createZodDto(
	z.object({
		newName: z.string().trim().nonempty(),
	}),
) {}
