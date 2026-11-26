import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	Patch,
	Post,
} from '@nestjs/common'
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import z from 'zod'
import { ApiErrorResponseDto } from '../../../common/http/dtos/api-error-response.dto.js'
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator.js'
import { UserMembershipDto } from '../../auth/presentation/dtos/user.dto.js'
import { AuthenticatedUser } from '../../auth/services/auth.service.js'
import { TeamsService } from '../application/teams.service.js'
import { CreateTeamDto } from './dtos/create-team.dto.js'
import { RemoveMemberDto } from './dtos/remove-member.dto.js'
import { PublicTeamDto } from './dtos/team.dto.js'
import { UpdateTeamDto } from './dtos/update-team.dto.js'
import { TeamsPresenter } from './teams.presenter.js'

export class TeamIdDto extends createZodDto(
	z.object({
		teamId: z.string(),
	}),
) {}

@ApiTags('Teams')
@ApiBearerAuth()
@Controller('api/teams')
export class TeamsController {
	constructor(private teamsService: TeamsService) {}

	// Get teams
	@ApiOperation({
		summary: 'Get user teams',
	})
	@ApiResponse({
		status: 200,
		description: 'User teams retrieved successfully.',
		type: PublicTeamDto,
		isArray: true,
	})
	@ApiResponse({
		status: 401,
		description: 'Authentication required or invalid access token.',
		type: ApiErrorResponseDto,
	})
	@Get()
	@HttpCode(200)
	async getTeams(@CurrentUser() user: AuthenticatedUser) {
		const { teams } = await this.teamsService.listUserTeams({
			userId: user.userId,
		})

		return teams.map(TeamsPresenter.toHTTP)
	}

	// Create team
	@ApiOperation({
		summary: 'Create team',
	})
	@ApiResponse({
		status: 201,
		description: 'Team created successfully.',
		type: PublicTeamDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Data validation failed.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 401,
		description: 'Authentication required or invalid access token.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 403,
		description: 'Team memberships limit reached.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 409,
		description: 'A team with the provided slug already exists.',
		type: ApiErrorResponseDto,
	})
	@Post()
	@HttpCode(201)
	async createTeam(
		@Body() body: CreateTeamDto,
		@CurrentUser() user: AuthenticatedUser,
	) {
		const { name, storageRetentionSeconds } = body

		const { team } = await this.teamsService.createTeam({
			userId: user.userId,
			name,
			storageRetentionSeconds,
		})

		return TeamsPresenter.toHTTP(team)
	}

	// Update team
	@ApiOperation({
		summary: 'Update team',
	})
	@ApiResponse({
		status: 200,
		description: 'Team updated successfully.',
		type: PublicTeamDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Data validation failed.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 401,
		description: 'Authentication required or invalid access token.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Team not found or inaccessible to the authenticated user.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 409,
		description: 'A team with the provided slug already exists.',
		type: ApiErrorResponseDto,
	})
	@Patch(':teamId')
	@HttpCode(200)
	async updateTeam(
		@CurrentUser() user: AuthenticatedUser,
		@Body() body: UpdateTeamDto,
		@Param() param: TeamIdDto,
	) {
		const { name, storageRetentionSeconds } = body
		const { teamId } = param

		const { team } = await this.teamsService.updateTeam({
			userId: user.userId,
			teamId,
			name,
			storageRetentionSeconds,
		})

		return TeamsPresenter.toHTTP(team)
	}

	// Get members
	@ApiOperation({
		summary: 'Get team members',
	})
	@ApiResponse({
		status: 200,
		description: 'Team members retrieved successfully.',
		type: UserMembershipDto,
		isArray: true,
	})
	@ApiResponse({
		status: 400,
		description: 'Data validation failed.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 401,
		description: 'Authentication required or invalid access token.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Team not found or inaccessible to the authenticated user.',
		type: ApiErrorResponseDto,
	})
	@Get(':teamId/members')
	@HttpCode(200)
	async listTeamMembers(
		@CurrentUser() user: AuthenticatedUser,
		@Param() param: TeamIdDto,
	) {
		const { teamId } = param

		const { users } = await this.teamsService.listTeamMembers({
			userId: user.userId,
			teamId,
		})

		return users
	}

	// Leave from team
	@ApiOperation({
		summary: 'Leave from team',
	})
	@ApiResponse({
		status: 204,
		description: 'Team left successfully.',
	})
	@ApiResponse({
		status: 400,
		description: 'Data validation failed.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 401,
		description: 'Authentication required or invalid access token.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Team not found or inaccessible to the authenticated user.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 409,
		description: 'Team owners cannot remove themselves.',
		type: ApiErrorResponseDto,
	})
	@Delete(':teamId/members/me')
	@HttpCode(204)
	async leaveFromTeam(
		@CurrentUser() user: AuthenticatedUser,
		@Param() param: TeamIdDto,
	) {
		const { teamId } = param

		await this.teamsService.leaveFromTeam({
			userId: user.userId,
			teamId,
		})

		return
	}

	// Remove member
	@ApiOperation({
		summary: 'Remove member from team',
	})
	@ApiResponse({
		status: 204,
		description: 'Team member removed successfully.',
	})
	@ApiResponse({
		status: 400,
		description: 'Data validation failed.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 401,
		description: 'Authentication required or invalid access token.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 404,
		description:
			'Team or member not found or inaccessible to the authenticated user.',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 409,
		description: 'Team owners cannot remove themselves.',
		type: ApiErrorResponseDto,
	})
	@Delete(':teamId/members/:memberId')
	@HttpCode(204)
	async removeMemberFromTeam(
		@CurrentUser() user: AuthenticatedUser,
		@Param() param: RemoveMemberDto,
	) {
		const { teamId, memberId } = param

		await this.teamsService.removeMemberFromTeam({
			userId: user.userId,
			teamId,
			memberId,
		})

		return
	}
}
