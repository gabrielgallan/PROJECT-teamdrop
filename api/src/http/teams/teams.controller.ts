import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import z from 'zod'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { AuthenticatedUser } from '../../auth/services/auth.service.js'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js'
import { CreateTeamDto, createTeamSchema } from './dtos/create-team.dto.js'
import { RemoveMemberDto, removeMemberSchema } from './dtos/remove-member.dto.js'
import { UpdateTeamDto, updateTeamSchema } from './dtos/update-team.dto.js'
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
		return this.teamsService.listUserTeams({
			userId: user.userId,
		})
	}

	@Post()
	@HttpCode(201)
	async createTeam(
		@Body(new ZodValidationPipe(createTeamSchema)) body: CreateTeamDto,
		@CurrentUser() user: AuthenticatedUser,
	) {
		const { name } = body

		return this.teamsService.createTeam({
			name,
			userId: user.userId,
		})
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

		return this.teamsService.updateTeam({
			userId: user.userId,
			teamId,
			newName,
		})
	}

	@Get(':teamId/members')
	@HttpCode(200)
	async getTeamMembers(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(teamIdSchema)) param: TeamIdDto,
	) {
		const { teamId } = param

		return this.teamsService.listTeamMembers({
			userId: user.userId,
			teamId,
		})
	}

	@Delete(':teamId/members/me')
	@HttpCode(204)
	async leaveFromTeam(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(teamIdSchema)) param: TeamIdDto,
	) {
		const { teamId } = param

		return this.teamsService.leaveFromTeam({
			userId: user.userId,
			teamId,
		})
	}

	@Delete(':teamId/members/:memberId')
	@HttpCode(204)
	async removeMemberFromTeam(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(removeMemberSchema)) param: RemoveMemberDto,
	) {
		const { teamId, memberId } = param

		return this.teamsService.removeMemberFromTeam({
			userId: user.userId,
			teamId,
			memberId,
		})
	}
}
