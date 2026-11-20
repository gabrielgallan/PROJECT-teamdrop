import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export const listTeamMembersParamsSchema = z.object({
	slug: z.string(),
})

export class ListTeamMembersParamsDto extends createZodDto(listTeamMembersParamsSchema) {}

export interface ListTeamMembersServiceInput {
	userId: string
	teamSlug: string
}
