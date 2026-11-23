import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export const acceptTeamInviteSchema = z.object({
	token: z.string(),
})

export class AcceptTeamInviteDto extends createZodDto(acceptTeamInviteSchema) {}

export interface AcceptTeamInviteServiceDto {
	userId: string
	token: string
}
