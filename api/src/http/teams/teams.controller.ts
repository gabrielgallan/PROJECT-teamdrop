import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { AuthenticatedUser, AuthService } from '../../auth/services/auth.service.js';
import { TeamsService } from './teams.service.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { CreateTeamDto, createTeamSchema } from './dtos/create-team.dto.js';
import { UpdateTeamBodyDto, updateTeamBodySchema, UpdateTeamParamDto, updateTeamParamSchema } from './dtos/update-team.dto.js';
import { CreateTeamInviteBodyDto, createTeamInviteBodySchema, CreateTeamInviteParamsDto, createTeamInviteParamsSchema } from './dtos/create-team-invite.dto.js';

@ApiTags('Teams')
@Controller('api/teams')
export class TeamsController {
    constructor(private teamsService: TeamsService) {}

    @Get()
    @HttpCode(200)
    async getTeams(
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.teamsService.listUserTeams({
            userId: user.userId
        })
    }

    @Post()
    @HttpCode(201)
    async createTeam(
        @Body(new ZodValidationPipe(createTeamSchema)) body: CreateTeamDto,
        @CurrentUser() user: AuthenticatedUser
    ) {
        const { name } = body

        return this.teamsService.createTeam({
            name,
            userId: user.userId
        })
    }

    @Patch(':slug')
    @HttpCode(204)
    async updateTeam(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodValidationPipe(updateTeamBodySchema)) body: UpdateTeamBodyDto,
        @Param(new ZodValidationPipe(updateTeamParamSchema)) param: UpdateTeamParamDto
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
    async createTeamInvite(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodValidationPipe(createTeamInviteBodySchema)) body: CreateTeamInviteBodyDto,
        @Param(new ZodValidationPipe(createTeamInviteParamsSchema)) param: CreateTeamInviteParamsDto
    ) {
        const { maxUses, expiresIn } = body
        const { slug } = param

        return this.teamsService.createTeamInvite({
            userId: user.userId,
            teamSlug: slug,
            maxUses,
            expiresIn
        })
    }
}
