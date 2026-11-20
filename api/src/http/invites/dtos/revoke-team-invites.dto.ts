import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export const revokeTeamInvitesBodySchema = z.object({
	teamSlug: z.string(),
})

export class RevokeTeamInvitesBodyDto extends createZodDto(revokeTeamInvitesBodySchema) {}

export interface RevokeTeamInvitesServiceInput {
	userId: string
	teamSlug: string
}
