import { ApiProperty } from '@nestjs/swagger'
import { PublicUserDto } from '../../../auth/presentation/dtos/public-user.dto.js'
import { TeamRole } from './team.dto.js'

// Responses
export class PublicMemberDto extends PublicUserDto {
	@ApiProperty({
		example: 'owner',
		enum: ['owner', 'member'],
	})
	role!: TeamRole
}

export class GetMembersResponseDto {
	@ApiProperty({ type: [PublicMemberDto] })
	users!: PublicMemberDto[]
}
