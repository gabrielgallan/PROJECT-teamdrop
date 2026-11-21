import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { AuthenticatedUser } from '../../auth/services/auth.service.js'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js'
import { AcceptTeamInviteDto, acceptTeamInviteSchema } from './dtos/accept-team-invite.dto.js'
import {
	CreateTeamInviteBodyDto,
	createTeamInviteBodySchema,
} from './dtos/create-team-invite.dto.js'
import {
	RevokeTeamInvitesBodyDto,
	revokeTeamInvitesBodySchema,
} from './dtos/revoke-team-invites.dto.js'
import { InvitesService } from './invites.service.js'

@ApiTags('Invites')
@ApiBearerAuth()
@Controller('api/invites')
export class InvitesController {
	constructor(private invitesService: InvitesService) {}

	@Post()
	@HttpCode(201)
	@Header('Cache-Control', 'no-store')
	async createTeamInvite(
		@CurrentUser() user: AuthenticatedUser,
		@Body(new ZodValidationPipe(createTeamInviteBodySchema)) body: CreateTeamInviteBodyDto,
	) {
		const { teamSlug, maxUses, expiresIn } = body

		return this.invitesService.createTeamInvite({
			userId: user.userId,
			teamSlug,
			maxUses,
			expiresIn,
		})
	}

	@Delete()
	@HttpCode(204)
	async revokeTeamInvite(
		@CurrentUser() user: AuthenticatedUser,
		@Body(new ZodValidationPipe(revokeTeamInvitesBodySchema)) body: RevokeTeamInvitesBodyDto,
	) {
		const { teamSlug } = body

		await this.invitesService.revokeTeamInvites({
			userId: user.userId,
			teamSlug,
		})

		return
	}

	@Get(':token/preview')
	@Header('Cache-Control', 'no-store')
	async previewTeamInvite(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(acceptTeamInviteSchema)) param: AcceptTeamInviteDto,
	) {
		return this.invitesService.previewInvite({ userId: user.userId, token: param.token })
	}

	@Post('accept')
	@HttpCode(200)
	@Header('Cache-Control', 'no-store')
	async acceptTeamInvite(
		@CurrentUser() user: AuthenticatedUser,
		@Body(new ZodValidationPipe(acceptTeamInviteSchema)) body: AcceptTeamInviteDto,
	) {
		const { token } = body

		return this.invitesService.acceptInvite({
			userId: user.userId,
			token,
		})
	}
}
