import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import z from 'zod'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import { AuthenticatedUser } from '../auth/services/auth.service.js'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js'
import { CreateTeamDto, createTeamSchema } from './dtos/create-team.dto.js'
import { RemoveMemberDto, removeMemberSchema } from './dtos/remove-member.dto.js'
import { UpdateTeamDto, updateTeamSchema } from './dtos/update-team.dto.js'
import { TeamsPresenter } from './presenters/teams.presenter.js'
import { TeamsService } from './teams.service.js'

export const teamIdSchema = z.object({
	teamId: z.string(),
})

export class TeamIdDto extends createZodDto(teamIdSchema) {}

@ApiTags('Teams')
@ApiBearerAuth()
@Controller('api/teams')
export class TeamsController {
	constructor(private teamsService: TeamsService) {}

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
			team: TeamsPresenter.toHTTP(team),
		}
	}

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
			team: TeamsPresenter.toHTTP(team),
		}
	}

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
