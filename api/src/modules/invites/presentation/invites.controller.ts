import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	Param,
	Post,
} from '@nestjs/common'
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger'
import { ApiErrorResponseDto } from '../../../common/http/dtos/api-error-response.dto.js'
import { ZodValidationPipe } from '../../../common/http/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator.js'
import { AuthenticatedUser } from '../../auth/services/auth.service.js'
import {
	TeamIdDto,
	teamIdSchema,
} from '../../teams/presentation/teams.controller.js'
import { TeamsPresenter } from '../../teams/presentation/teams.presenter.js'
import { InvitesService } from '../application/invites.service.js'
import {
	AcceptTeamInviteDto,
	AcceptTeamInviteResponseDto,
	acceptTeamInviteSchema,
} from './dtos/accept-team-invite.dto.js'
import {
	CreateInviteResponseDto,
	CreateTeamInviteDto,
	createTeamInviteSchema,
} from './dtos/create-team-invite.dto.js'
import {
	GetInviteDetailsDto,
	GetInviteDetailsResponseDto,
	getInviteDetailsSchema,
} from './dtos/get-invite-details.dto.js'

@ApiTags('Invites')
@ApiBearerAuth()
@Controller('api/invites')
export class InvitesController {
	constructor(private invitesService: InvitesService) {}

	// Create invite
	@ApiOperation({
		summary: 'Create team invite',
	})
	@ApiResponse({
		status: 201,
		description: 'Team invite successfully created.',
		type: CreateInviteResponseDto,
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
		description: 'User not allowed to manage this resource',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 404,
		description:
			'Resource not found or inaccessible to the authenticated user.',
		type: ApiErrorResponseDto,
	})
	@Post()
	@HttpCode(201)
	@Header('Cache-Control', 'no-store')
	async createTeamInvite(
		@CurrentUser() user: AuthenticatedUser,
		@Body(new ZodValidationPipe(createTeamInviteSchema))
		body: CreateTeamInviteDto,
	) {
		const { teamId, maxUses, expiresIn } = body

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

	// Revoke invites
	@ApiOperation({
		summary: 'Revoke team invites',
	})
	@ApiResponse({
		status: 204,
		description: 'Team invites successfully revoked.',
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
		description: 'User not allowed to manage this resource',
		type: ApiErrorResponseDto,
	})
	@ApiResponse({
		status: 404,
		description:
			'Resource not found or inaccessible to the authenticated user.',
		type: ApiErrorResponseDto,
	})
	@Delete()
	@HttpCode(204)
	async revokeTeamInvite(
		@CurrentUser() user: AuthenticatedUser,
		@Body(new ZodValidationPipe(teamIdSchema)) body: TeamIdDto,
	) {
		const { teamId } = body

		await this.invitesService.revokeTeamInvites({
			userId: user.userId,
			teamId,
		})

		return
	}

	// Get user invite status
	@ApiOperation({
		summary: 'Get invite details',
	})
	@ApiResponse({
		status: 200,
		description:
			'Invite details and user membership status retrieved successfully.',
		type: GetInviteDetailsResponseDto,
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
		status: 410,
		description: 'Invalid or expired invitation.',
		type: ApiErrorResponseDto,
	})
	@Get(':token')
	@HttpCode(200)
	@Header('Cache-Control', 'no-store')
	async getInviteDetails(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(getInviteDetailsSchema))
		param: GetInviteDetailsDto,
	) {
		const { team, alreadyMember } = await this.invitesService.getInviteDetails({
			userId: user.userId,
			token: param.token,
		})

		return {
			team,
			alreadyMember,
		}
	}

	// Accept invite
	@ApiOperation({
		summary: 'Accept invite',
	})
	@ApiResponse({
		status: 201,
		description: 'Team invite successfully accepted.',
		type: AcceptTeamInviteResponseDto,
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
		status: 410,
		description: 'Invalid or expired invitation.',
		type: ApiErrorResponseDto,
	})
	@Post(':token/accept')
	@HttpCode(201)
	@Header('Cache-Control', 'no-store')
	async acceptTeamInvite(
		@CurrentUser() user: AuthenticatedUser,
		@Param(new ZodValidationPipe(acceptTeamInviteSchema))
		param: AcceptTeamInviteDto,
	) {
		const { team } = await this.invitesService.acceptInvite({
			userId: user.userId,
			token: param.token,
		})

		return {
			team: TeamsPresenter.teamWithRoleToHTTP(team),
		}
	}
}
