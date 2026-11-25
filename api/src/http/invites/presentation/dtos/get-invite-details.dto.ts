import { ApiProperty } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export const getInviteDetailsSchema = z.object({
	token: z.string(),
})

export class GetInviteDetailsDto extends createZodDto(getInviteDetailsSchema) {}

export interface GetInviteDetailsServiceDto {
	userId: string
	token: string
}

class InviteTeamDto {
	@ApiProperty({
		example: 'a7cd927d-de92-4af8-b16c-797bb1ec1641',
	})
	id!: string

	@ApiProperty({
		example: 'Engineering Team',
	})
	name!: string

	@ApiProperty({
		example: 'engineering-team',
	})
	slug!: string
}

export class GetInviteDetailsResponseDto {
	@ApiProperty({
		type: InviteTeamDto,
		description: 'Team associated with the invite.',
	})
	team!: InviteTeamDto

	@ApiProperty({
		example: false,
		description:
			'Indicates whether the authenticated user is already a member of the team.',
	})
	alreadyMember!: boolean
}
