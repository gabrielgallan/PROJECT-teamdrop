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
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { AuthenticatedUser } from '../../auth/services/auth.service.js'
import { ApiErrorResponseDto } from '../../dtos/api-error-response.dto.js'
import { ZodValidationPipe } from '../../pipes/zod-validation.pipe.js'
import { TeamsService } from '../application/teams.service.js'
import { CreateTeamDto, createTeamSchema } from './dtos/create-team.dto.js'
import { GetMembersResponseDto } from './dtos/member.dto.js'
import {
	RemoveMemberDto,
	removeMemberSchema,
} from './dtos/remove-member.dto.js'
import { CreateTeamResponseDto, GetTeamsResponseDto } from './dtos/team.dto.js'
import { UpdateTeamDto, updateTeamSchema } from './dtos/update-team.dto.js'
import { TeamsPresenter } from './teams.presenter.js'

export const teamIdSchema = z.object({
	teamId: z.string(),
})

export class TeamIdDto extends createZodDto(teamIdSchema) {}

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
		type: GetTeamsResponseDto,
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

		return {
			teams: teams.map(TeamsPresenter.teamWithRoleToHTTP),
		}
	}

	// Create team
	@ApiOperation({
		summary: 'Create team',
	})
	@ApiResponse({
		status: 201,
		description: 'Team created successfully.',
		type: CreateTeamResponseDto,
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
		status: 409,
		description: 'A team with the provided slug already exists.',
		type: ApiErrorResponseDto,
	})
	@Post()
	@HttpCode(201)
	async createTeam(
		@Body(new ZodValidationPipe(createTeamSchema)) body: CreateTeamDto,
		@CurrentUser() user: AuthenticatedUser,
	) {
		const { name } = body

		const { team } = await this.teamsService.createTeam({
			name,
			userId: user.userId,
		})

		return {
			team: TeamsPresenter.toHTTP(team, user.userId),
		}
	}

	// Update team
	@ApiOperation({
		summary: 'Update team',
	})
	@ApiResponse({
		status: 200,
		description: 'Team updated successfully.',
		type: CreateTeamResponseDto,
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
		@Body(new ZodValidationPipe(updateTeamSchema)) body: UpdateTeamDto,
		@Param(new ZodValidationPipe(teamIdSchema)) param: TeamIdDto,
	) {
		const { newName } = body
		const { teamId } = param

		const { team } = await this.teamsService.updateTeam({
			userId: user.userId,
			teamId,
			newName,
		})

		return {
			team: TeamsPresenter.toHTTP(team, user.userId),
		}
	}

	// Get members
	@ApiOperation({
		summary: 'Get team members',
	})
	@ApiResponse({
		status: 200,
		description: 'Team members retrieved successfully.',
		type: GetMembersResponseDto,
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
	async getTeamMembers(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(teamIdSchema)) param: TeamIdDto,
	) {
		const { teamId } = param

		const { users } = await this.teamsService.listTeamMembers({
			userId: user.userId,
			teamId,
		})

		return {
			users,
		}
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
		@Param(new ZodValidationPipe(teamIdSchema)) param: TeamIdDto,
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
		@Param(new ZodValidationPipe(removeMemberSchema)) param: RemoveMemberDto,
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
