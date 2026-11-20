import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common'
import { slugify } from '../../common/utils/slugify.js'
import { PrismaService } from '../../database/prisma/prisma.service.js'
import { CreateTeamServiceInput } from './dtos/create-team.dto.js'
import { ListTeamMembersServiceInput } from './dtos/list-teams-members.dto.js'
import { ListUserTeamsServiceInput } from './dtos/list-user-teams.dto.js'
import { UpdateTeamServiceInput } from './dtos/update-team.dto.js'

@Injectable()
export class TeamsService {
	constructor(private prisma: PrismaService) {}

	async createTeam({ name, userId }: CreateTeamServiceInput) {
		const slug = slugify(name)

		const teamAlreadyExists = await this.prisma.team.findUnique({
			where: {
				slug,
			},
		})

		if (teamAlreadyExists) {
			throw new ConflictException({
				message: 'Team name already exists',
			})
		}

		const team = await this.prisma.team.create({
			data: {
				name,
				slug,
				ownerId: userId,
				members: {
					create: {
						userId,
					},
				},
			},
		})

		return {
			team,
		}
	}

	async listUserTeams({ userId }: ListUserTeamsServiceInput) {
		const teams = await this.prisma.team.findMany({
			where: {
				members: {
					some: {
						userId,
					},
				},
			},
		})

		return {
			teams: teams.map((team) => {
				return {
					...team,
					role: team.ownerId === userId ? 'owner' : 'member',
				}
			}),
		}
	}

	async updateTeam({ userId, teamSlug, newName }: UpdateTeamServiceInput) {
		const team = await this.prisma.team.findUnique({
			where: {
				slug: teamSlug,
			},
		})

		if (!team) {
			throw new NotFoundException({
				message: 'Team not found',
			})
		}

		if (team.ownerId !== userId) {
			throw new ForbiddenException({
				message: 'User not allowed to modify team',
			})
		}

		const slug = slugify(newName)

		const teamAlreadyExists = await this.prisma.team.findUnique({
			where: {
				slug,
			},
		})

		if (teamAlreadyExists && teamAlreadyExists.id !== team.id) {
			throw new ConflictException({
				message: 'Team name already exists',
			})
		}

		const updatedTeam = await this.prisma.team.update({
			where: {
				id: team.id,
			},
			data: {
				name: newName,
				slug,
			},
		})

		return {
			team: updatedTeam,
		}
	}

	async listTeamMembers({ userId, teamSlug }: ListTeamMembersServiceInput) {
		const team = await this.prisma.team.findUnique({
			where: {
				slug: teamSlug,
			},
		})

		if (!team) {
			throw new NotFoundException({
				message: 'Team not found',
			})
		}

		if (team.ownerId !== userId) {
			throw new ForbiddenException({
				message: 'User not allowed to list team members',
			})
		}

		const members = await this.prisma.user.findMany({
			where: {
				members_on: {
					some: {
						teamId: team.id,
					},
				},
			},
			select: { id: true, name: true, email: true, avatarUrl: true },
		})

		return {
			users: members.map((member) => {
				return {
					...member,
					role: member.id === team.ownerId ? 'owner' : 'member',
				}
			}),
		}
	}
}
