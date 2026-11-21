import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export const removeMemberSchema = z.object({
	slug: z.string(),
	memberId: z.string(),
})

export class RemoveMemberDto extends createZodDto(removeMemberSchema) {}

export interface RemoveMemberServiceInput {
	userId: string
	teamSlug: string
	memberId: string
}
