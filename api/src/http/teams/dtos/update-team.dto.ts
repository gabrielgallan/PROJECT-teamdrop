import { createZodDto } from "nestjs-zod";
import z from "zod";

export const updateTeamBodySchema = z.object({
    newName: z.string().trim().nonempty()
})

export const updateTeamParamSchema = z.object({
    slug: z.string()
})

export class UpdateTeamBodyDto extends createZodDto(updateTeamBodySchema) {}

export class UpdateTeamParamDto extends createZodDto(updateTeamParamSchema) {}

export type UpdateTeamServiceInput = {
    userId: string
    teamSlug: string
    newName: string
}
