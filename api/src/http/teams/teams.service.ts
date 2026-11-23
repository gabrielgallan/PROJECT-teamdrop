import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common'
import { slugify } from '../../common/utils/slugify.js'
import { PrismaService } from '../../database/prisma/prisma.service.js'
import { CreateTeamServiceDto } from './dtos/create-team.dto.js'
import { LeaveTeamServiceDto } from './dtos/leave-team.dto.js'
import { ListTeamMembersServiceDto } from './dtos/list-teams-members.dto.js'
import { ListUserTeamsServiceDto } from './dtos/list-user-teams.dto.js'
import { RemoveMemberServiceDto } from './dtos/remove-member.dto.js'
import { UpdateTeamServiceDto } from './dtos/update-team.dto.js'
import { TeamsPresenter } from './presenters/teams.presenter.js'

@Injectable()
export class TeamsService {
	constructor(private prisma: PrismaService) {}

	async createTeam({ name, userId }: CreateTeamServiceDto) {
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

	async listUserTeams({ userId }: ListUserTeamsServiceDto) {
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

	async updateTeam({ userId, teamId, newName }: UpdateTeamServiceDto) {
		const team = await this.prisma.team.findUnique({
			where: {
				id: teamId,
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

	async listTeamMembers({ userId, teamId }: ListTeamMembersServiceDto) {
		const team = await this.prisma.team.findUnique({
			where: {
				id: teamId,
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
					memberRole: member.id === team.ownerId ? 'owner' : 'member',
				}
			}),
		}
	}

	async leaveFromTeam({ userId, teamId }: LeaveTeamServiceDto) {
		const membership = await this.prisma.member.findFirst({
			where: {
				team: {
					id: teamId,
				},
				userId,
			},
			include: {
				team: {
					select: {
						ownerId: true,
					},
				},
			},
		})

		if (!membership) {
			throw new NotFoundException({
				message: 'User team membership not found',
			})
		}

		if (membership.team.ownerId === userId) {
			throw new ForbiddenException({
				message: 'Team owners cannot leave the team',
			})
		}

		await this.prisma.member.delete({
			where: {
				teamId_userId: {
					userId,
					teamId: membership.teamId,
				},
			},
		})

		return
	}

	async removeMemberFromTeam({ userId, teamId, memberId }: RemoveMemberServiceDto) {
		const membership = await this.prisma.member.findUnique({
			where: {
				teamId_userId: {
					userId,
					teamId,
				},
			},
			select: {
				teamId: true,
				team: {
					select: {
						ownerId: true,
					},
				},
			},
		})

		if (!membership) {
			throw new NotFoundException({
				message: 'User team membership not found',
			})
		}

		if (membership.team.ownerId !== userId) {
			throw new ForbiddenException({
				message: 'User not allowed to manage this team',
			})
		}

		if (memberId === userId) {
			throw new ForbiddenException({
				message: 'Team owners cannot remove themselves',
			})
		}

		const userMembershipToRemove = await this.prisma.member.findUnique({
			where: {
				teamId_userId: {
					teamId: membership.teamId,
					userId: memberId,
				},
			},
		})

		if (!userMembershipToRemove) {
			throw new NotFoundException({
				message: 'Resource not found',
			})
		}

		await this.prisma.member.delete({
			where: {
				teamId_userId: {
					teamId: membership.teamId,
					userId: memberId,
				},
			},
		})

		return
	}
}
