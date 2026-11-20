import { createZodDto } from "nestjs-zod";
import z from "zod";

export const createTeamInviteParamsSchema = z.object({
    slug: z.string()
})

export const createTeamInviteBodySchema = z.object({
    maxUses: z.number().int().min(1).max(100).default(100),
    expiresIn: z.number().int().min(60).max(2592000).default(7 * 24 * 60 * 60),
}).default({ maxUses: 100, expiresIn: 7 * 24 * 60 * 60 })

export class CreateTeamInviteParamsDto extends createZodDto(createTeamInviteParamsSchema) {}

export class CreateTeamInviteBodyDto extends createZodDto(createTeamInviteBodySchema) {}

export interface CreateTeamInviteServiceInput {
    userId: string
    teamSlug: string
    maxUses: number
    expiresIn: number
}
