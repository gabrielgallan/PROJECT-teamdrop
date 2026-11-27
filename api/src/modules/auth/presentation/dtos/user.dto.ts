import { ApiProperty } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const publicUserSchema = z.object({
	id: z.uuid(),
	email: z.string(),
	name: z.string().nullable(),
	avatarUrl: z.string().nullable(),
})

export class PublicUserDto extends createZodDto(publicUserSchema) {}

export class UserDto {
	@ApiProperty({
		example: 'a7cd927d-de92-4af8-b16c-797bb1ec1641',
	})
	id!: string

	@ApiProperty({
		example: 'user@example.com',
	})
	email!: string

	@ApiProperty({
		example: 'John Doe',
	})
	name!: string | null

	@ApiProperty({
		example: 'https://app.com/avatar-1',
	})
	avatarUrl!: string | null

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
}

export class UserMembershipDto extends UserDto {
	@ApiProperty({
		enum: ['owner', 'member'],
		example: 'owner',
	})
	role!: string
}

export class ProfileResponseDto {
	@ApiProperty({ type: PublicUserDto })
	user!: PublicUserDto
}
