import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export class GetInviteDetailsDto extends createZodDto(
	z.object({
		token: z.string(),
	}),
) {}
