import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export const updateTeamSchema = z.object({
	newName: z.string().trim().nonempty(),
})

export class UpdateTeamDto extends createZodDto(updateTeamSchema) {}

export type UpdateTeamServiceDto = {
	userId: string
	teamId: string
	newName: string
}
