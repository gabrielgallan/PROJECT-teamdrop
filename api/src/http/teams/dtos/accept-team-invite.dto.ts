import { createZodDto } from "nestjs-zod";
import z from "zod";

export const acceptTeamInviteSchema = z.object({
    inviteId: z.string(),
    userId: z.string()
})

export class AcceptTeamInviteDto extends createZodDto(acceptTeamInviteSchema) {}

export type AcceptTeamInviteServiceInput = z.infer<typeof acceptTeamInviteSchema>