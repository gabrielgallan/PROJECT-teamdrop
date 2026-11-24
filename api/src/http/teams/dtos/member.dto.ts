import { ApiProperty } from '@nestjs/swagger'
import { TeamRole } from './team.dto.js'
import { PublicUserDto } from '../../auth/dtos/public-user.dto.js'

// Responses
export class PublicMemberDto extends PublicUserDto {    
    @ApiProperty({
        example: 'owner',
        enum: ['owner', 'member']
    })
    role!: TeamRole
}

export class GetMembersResponseDto {
    @ApiProperty({ type: [PublicMemberDto] })
    users!: PublicMemberDto[]
}