import { ApiProperty } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export class CreateTeamInviteDto extends createZodDto(
	z.object({
		teamId: z.string(),
		maxUses: z.number().int().min(1).max(100).default(100),
		expiresIn: z
			.number()
			.int()
			.min(60)
			.max(2592000)
			.default(60 * 60 * 24 * 7), // 7 days
	}),
) {}

export class CreateInviteResponseDto {
	@ApiProperty({
		example: 'http://example.com',
	})
	url!: string
}
