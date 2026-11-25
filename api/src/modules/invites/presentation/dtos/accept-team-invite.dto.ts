import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export class AcceptTeamInviteDto extends createZodDto(
	z.object({
		token: z.string(),
	}),
) {}
