import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export const createTeamInviteBodySchema = z.object({
	teamSlug: z.string(),
	maxUses: z.number().int().min(1).max(100).default(100),
	expiresIn: z
		.number()
		.int()
		.min(60)
		.max(2592000)
		.default(60 * 60 * 24 * 7), // 7 days
})

export class CreateTeamInviteBodyDto extends createZodDto(createTeamInviteBodySchema) {}

export interface CreateTeamInviteServiceInput {
	userId: string
	teamSlug: string
	maxUses: number
	expiresIn: number
}
