import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export const leaveTeamSchema = z.object({
	slug: z.string(),
})

export class LeaveTeamDto extends createZodDto(leaveTeamSchema) {}

export interface LeaveTeamServiceInput {
	userId: string
	teamSlug: string
}
