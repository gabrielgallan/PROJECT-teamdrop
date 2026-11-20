import { createZodDto } from "nestjs-zod";
import z from "zod";

export const createTeamSchema = z.object({
    name: z.string().trim().nonempty()
})

export class CreateTeamDto extends createZodDto(createTeamSchema) {}

export interface CreateTeamServiceInput {
    name: string,
    userId: string
}
