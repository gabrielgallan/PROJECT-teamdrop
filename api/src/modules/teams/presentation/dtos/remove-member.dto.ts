import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export class RemoveMemberDto extends createZodDto(
	z.object({
		teamId: z.string(),
		memberId: z.string(),
	}),
) {}
