import {
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common'
import { slugify } from '../../../common/utils/slugify.js'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js'
import {
	CreateTeamServiceInput,
	LeaveTeamServiceInput,
	ListTeamMembersServiceInput,
	ListUserTeamsServiceInput,
	RemoveMemberServiceInput,
	UpdateTeamServiceInput,
} from './teams.types.js'

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
			team: {
				...team,
				role: 'owner',
			},
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

	async updateTeam({ userId, teamId, newName }: UpdateTeamServiceInput) {
		const team = await this.prisma.team.findUnique({
			where: {
				id: teamId,
				ownerId: userId,
			},
		})

		if (!team) {
			throw new NotFoundException({
				message: 'Resource not found',
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
			team: {
				...updatedTeam,
				role: 'owner',
			},
		}
	}

	async listTeamMembers({ userId, teamId }: ListTeamMembersServiceInput) {
		const membership = await this.prisma.member.findUnique({
			where: {
				teamId_userId: {
					userId,
					teamId,
				},
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

		const members = await this.prisma.user.findMany({
			where: {
				members_on: {
					some: {
						teamId: membership.teamId,
					},
				},
			},
		})

		return {
			users: members.map((member) => {
				return {
					...member,
					role: member.id === membership.team.ownerId ? 'owner' : 'member',
				}
			}),
		}
	}

	async leaveFromTeam({ userId, teamId }: LeaveTeamServiceInput) {
		const membership = await this.prisma.member.findUnique({
			where: {
				teamId_userId: {
					teamId,
					userId,
				},
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
			throw new ConflictException({
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

	async removeMemberFromTeam({
		userId,
		teamId,
		memberId,
	}: RemoveMemberServiceInput) {
		const team = await this.prisma.team.findUnique({
			where: {
				id: teamId,
				ownerId: userId,
			},
			select: {
				id: true,
			},
		})

		if (!team) {
			throw new NotFoundException({
				message: 'Resource not found',
			})
		}

		if (memberId === userId) {
			throw new ConflictException({
				message: 'Team owners cannot remove themselves',
			})
		}

		const userMembershipToRemove = await this.prisma.member.findUnique({
			where: {
				teamId_userId: {
					teamId: team.id,
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
					teamId: team.id,
					userId: memberId,
				},
			},
		})
	}
}
