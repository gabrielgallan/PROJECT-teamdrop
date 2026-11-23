import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export const removeMemberSchema = z.object({
	teamId: z.string(),
	memberId: z.string(),
})

export class RemoveMemberDto extends createZodDto(removeMemberSchema) {}

export interface RemoveMemberServiceDto {
	userId: string
	teamId: string
	memberId: string
}
