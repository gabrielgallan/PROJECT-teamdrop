import { ConflictException, ForbiddenException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { CreateTeamServiceInput } from './dtos/create-team.dto.js';
import { slugify } from '../../common/utils/slugify.js';
import { AcceptTeamInviteServiceInput } from './dtos/accept-team-invite.dto.js';
import { ListUserTeamsServiceInput } from './dtos/list-user-teams.dto.js';
import { UpdateTeamServiceInput } from './dtos/update-team.dto.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class TeamsService {
    constructor(private prisma: PrismaService, private usersService: UsersService) {}

    async createTeam({ name, userId }: CreateTeamServiceInput) {
        const user = await this.usersService.findUserById(userId)

        const slug = slugify(name)

        const teamAlreadyExists = await this.prisma.team.findUnique({
            where: {
                slug
            }
        })

        if (teamAlreadyExists) {
            throw new ConflictException({
                message: 'Team name already exists',
                statusCode: 409,
            })
        }

        const team = await this.prisma.team.create({
            data: {
                name,
                slug,
                ownerId: userId,
                members: {
                    create: {
                        userId
                    }
                }
            }
        })

        return team
    }

    async listUserTeams({ userId }: ListUserTeamsServiceInput) {
        const user = await this.usersService.findUserById(userId)

        const teams = await this.prisma.team.findMany({
            where: {
                members: {
                    some: {
                        userId
                    }
                }
            }
        })

        return teams
    }

    async updateTeam({ userId, teamSlug, newName }: UpdateTeamServiceInput) {
        const user = await this.usersService.findUserById(userId)

        const team = await this.prisma.team.findUnique({
            where: {
                slug: teamSlug
            }
        })
        
        if (!team) {
            throw new NotFoundException({
                message: 'Team not found',
                statusCode: 404,
            })
        }

        if (team.ownerId !== userId) {
            throw new ForbiddenException({
                message: 'User not allowed to modify team',
                statusCode: 403,
            })
        }

        const slug = slugify(newName)

        const teamAlreadyExists = await this.prisma.team.findUnique({
            where: {
                slug
            }
        })

        if (teamAlreadyExists && teamAlreadyExists.id !== team.id) {
            throw new ConflictException({
                message: 'Team name already exists',
                statusCode: 409,
            })
        } 

        const updatedTeam = await this.prisma.team.update({
            where: {
                id: team.id
            },
            data: {
                name: newName,
                slug
            }
        })

        return updatedTeam
    }

    async findTeamById(teamId: string) {
        const team = await this.prisma.team.findUnique({
            where: {
                id: teamId
            }
        })

        if (!team) {
            throw new NotFoundException({
                message: 'Team not found',
                statusCode: 404,
            })
        }

        return team
    }
}