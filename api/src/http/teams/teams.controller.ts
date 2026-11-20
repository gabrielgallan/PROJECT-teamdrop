import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { AuthenticatedUser } from '../../auth/services/auth.service.js'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js'
import { AcceptTeamInviteDto, acceptTeamInviteSchema } from './dtos/accept-team-invite.dto.js'
import { CreateTeamDto, createTeamSchema } from './dtos/create-team.dto.js'
import {
	CreateTeamInviteBodyDto,
	CreateTeamInviteParamsDto,
	createTeamInviteBodySchema,
	createTeamInviteParamsSchema,
} from './dtos/create-team-invite.dto.js'
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

	@Post(':slug/invites')
	@HttpCode(201)
	@Header('Cache-Control', 'no-store')
	async createTeamInvite(
		@CurrentUser() user: AuthenticatedUser,
		@Body(new ZodValidationPipe(createTeamInviteBodySchema)) body: CreateTeamInviteBodyDto,
		@Param(new ZodValidationPipe(createTeamInviteParamsSchema)) param: CreateTeamInviteParamsDto,
	) {
		const { maxUses, expiresIn } = body
		const { slug } = param

		return this.teamsService.createTeamInvite({
			userId: user.userId,
			teamSlug: slug,
			maxUses,
			expiresIn,
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

	@Get(':slug/invites/active')
	@HttpCode(200)
	@Header('Cache-Control', 'no-store')
	async getActiveInvite(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(createTeamInviteParamsSchema)) param: CreateTeamInviteParamsDto,
	) {
		return this.teamsService.getActiveInvite({ userId: user.userId, teamSlug: param.slug })
	}

	@Delete(':slug/invites/active')
	@HttpCode(204)
	async revokeActiveInvite(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(createTeamInviteParamsSchema)) param: CreateTeamInviteParamsDto,
	) {
		await this.teamsService.revokeActiveInvite({ userId: user.userId, teamSlug: param.slug })
	}

	@Post('invites/accept')
	@HttpCode(200)
	async acceptInvite(
		@CurrentUser() user: AuthenticatedUser,
		@Body(new ZodValidationPipe(acceptTeamInviteSchema)) body: AcceptTeamInviteDto,
	) {
		return this.teamsService.acceptInvite({ userId: user.userId, token: body.token })
	}
}
