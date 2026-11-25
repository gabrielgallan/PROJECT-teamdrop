import { createZodDto } from 'nestjs-zod'
import z from 'zod'

// Requests
export const createTeamSchema = z.object({
	name: z.string().trim().nonempty(),
})

export class CreateTeamDto extends createZodDto(createTeamSchema) {}

export interface CreateTeamServiceDto {
	name: string
	userId: string
}
