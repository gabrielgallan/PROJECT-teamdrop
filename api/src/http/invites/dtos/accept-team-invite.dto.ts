import { ApiProperty } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import z from 'zod'
import { TeamIdDto } from '../../teams/teams.controller.js'
import { PublicTeamDto } from '../../teams/dtos/team.dto.js'

export const acceptTeamInviteSchema = z.object({
	token: z.string(),
})

export class AcceptTeamInviteDto extends createZodDto(acceptTeamInviteSchema) {}

export interface AcceptTeamInviteServiceDto {
	userId: string
	token: string
}

export class AcceptTeamInviteResponseDto {
	@ApiProperty({
		type: PublicTeamDto,
	})
	team!: PublicTeamDto
}
