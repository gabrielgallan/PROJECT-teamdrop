import { ApiProperty } from '@nestjs/swagger'

export type TeamRole = 'member' | 'owner'

// Responses
export class PublicTeamDto {
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

	@ApiProperty({
		example: 'owner',
		enum: ['owner', 'member'],
	})
	role!: TeamRole
}

export class GetTeamsResponseDto {
	@ApiProperty({ type: [PublicTeamDto] })
	teams!: PublicTeamDto[]
}

export class CreateTeamResponseDto {
	@ApiProperty({ type: PublicTeamDto })
	team!: PublicTeamDto
}
