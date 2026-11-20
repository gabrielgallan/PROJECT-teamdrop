import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export const acceptTeamInviteSchema = z.object({
	token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
})

export class AcceptTeamInviteDto extends createZodDto(acceptTeamInviteSchema) {}

export interface AcceptTeamInviteServiceInput {
	userId: string
	token: string
}
