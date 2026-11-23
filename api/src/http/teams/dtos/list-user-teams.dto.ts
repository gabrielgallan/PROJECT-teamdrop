import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export const listUserTeamsSchema = z.object({
	userId: z.string().nonempty(),
})

export class ListUserTeamsDto extends createZodDto(listUserTeamsSchema) {}

export type ListUserTeamsServiceDto = z.infer<typeof listUserTeamsSchema>
