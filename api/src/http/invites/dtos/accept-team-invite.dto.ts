import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export const acceptTeamInviteSchema = z.object({
	token: z.string(),
})

export class AcceptTeamInviteDto extends createZodDto(acceptTeamInviteSchema) {}

export interface AcceptTeamInviteServiceInput {
	userId: string
	token: string
}
