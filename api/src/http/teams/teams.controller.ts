import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { AuthenticatedUser } from '../../auth/services/auth.service.js'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js'
import { CreateTeamDto, createTeamSchema } from './dtos/create-team.dto.js'
import {
	ListTeamMembersParamsDto,
	listTeamMembersParamsSchema,
} from './dtos/list-teams-members.dto.js'
import {
	UpdateTeamBodyDto,
	UpdateTeamParamDto,
	updateTeamBodySchema,
	updateTeamParamSchema,
} from './dtos/update-team.dto.js'
import { TeamsService } from './teams.service.js'

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

	@Patch(':slug')
	@HttpCode(200)
	async updateTeam(
		@CurrentUser() user: AuthenticatedUser,
		@Body(new ZodValidationPipe(updateTeamBodySchema)) body: UpdateTeamBodyDto,
		@Param(new ZodValidationPipe(updateTeamParamSchema)) param: UpdateTeamParamDto,
	) {
		const { newName } = body
		const { slug } = param

		return this.teamsService.updateTeam({
			userId: user.userId,
			teamSlug: slug,
			newName,
		})
	}

	@Get(':slug/members')
	@HttpCode(200)
	async getTeamMembers(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(listTeamMembersParamsSchema)) param: ListTeamMembersParamsDto,
	) {
		const { slug } = param

		return this.teamsService.listTeamMembers({
			userId: user.userId,
			teamSlug: slug,
		})
	}
}
