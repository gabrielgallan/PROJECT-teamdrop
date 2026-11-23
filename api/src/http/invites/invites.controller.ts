import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { AuthenticatedUser } from '../../auth/services/auth.service.js'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js'
import { TeamIdDto, teamIdSchema } from '../teams/teams.controller.js'
import { AcceptTeamInviteDto, acceptTeamInviteSchema } from './dtos/accept-team-invite.dto.js'
import { CreateTeamInviteDto, createTeamInviteSchema } from './dtos/create-team-invite.dto.js'
import { InvitesService } from './invites.service.js'
import { TeamsPresenter } from '../teams/presenters/teams.presenter.js'

@ApiTags('Invites')
@ApiBearerAuth()
@Controller('api')
export class InvitesController {
	constructor(private invitesService: InvitesService) {}

	@Post('teams/:teamId/invites')
	@HttpCode(201)
	@Header('Cache-Control', 'no-store')
	async createTeamInvite(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(teamIdSchema)) param: TeamIdDto,
		@Body(new ZodValidationPipe(createTeamInviteSchema)) body: CreateTeamInviteDto,
	) {
		const { maxUses, expiresIn } = body
		const { teamId } = param

		const { url } = await this.invitesService.createTeamInvite({
			userId: user.userId,
			teamId,
			maxUses,
			expiresIn,
		})

		return {
			url,
		}
	}

	@Delete('teams/:teamId/invites')
	@HttpCode(204)
	async revokeTeamInvite(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(teamIdSchema)) param: TeamIdDto,
	) {
		const { teamId } = param

		await this.invitesService.revokeTeamInvites({
			userId: user.userId,
			teamId,
		})

		return
	}

	@Get('invites/:token/preview')
	@Header('Cache-Control', 'no-store')
	async previewTeamInvite(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(acceptTeamInviteSchema)) param: AcceptTeamInviteDto,
	) {
		const { team, alreadyMember } = await this.invitesService.previewInvite({ 
			userId: user.userId, 
			token: param.token 
		})
		
		return {
			team,
			alreadyMember
		}
	}

	@Post('invites/accept')
	@HttpCode(200)
	@Header('Cache-Control', 'no-store')
	async acceptTeamInvite(
		@CurrentUser() user: AuthenticatedUser,
		@Body(new ZodValidationPipe(acceptTeamInviteSchema)) body: AcceptTeamInviteDto,
	) {
		const { token } = body

		const { team } = await this.invitesService.acceptInvite({
			userId: user.userId,
			token,
		})

		return {
			team: TeamsPresenter.teamWithRoleToHTTP(team)
		}
	}
}
