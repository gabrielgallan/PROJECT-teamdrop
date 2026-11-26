import { ApiProperty } from '@nestjs/swagger'

export type Role = 'member' | 'owner' | 'invited'

export class TeamDto {
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
		type: Date,
		example: '2026-11-25T12:00:00.000Z',
	})
	createdAt!: Date

	@ApiProperty({
		type: Date,
		example: '2026-11-25T15:30:00.000Z',
	})
	updatedAt!: Date

	@ApiProperty({
		type: 'integer',
		description: 'File retention period in seconds',
		minimum: 900,
		maximum: 259200,
		default: 86400,
		example: 86400,
	})
	storageRetentionSeconds!: number
}

export class PublicTeamDto extends TeamDto {
	@ApiProperty({
		enum: ['owner', 'member', 'invited'],
		example: 'owner',
	})
	role!: Role
}
