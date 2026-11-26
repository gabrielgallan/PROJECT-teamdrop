import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common'
import { slugify } from '../../../common/utils/slugify.js'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js'
import { Role } from '../presentation/dtos/team.dto.js'
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

	async createTeam({
		userId,
		name,
		storageRetentionSeconds = 86400,
	}: CreateTeamServiceInput) {
		const userMemberships = await this.prisma.member.count({
			where: {
				userId,
			},
		})

		if (userMemberships >= 5) {
			throw new ForbiddenException({
				message: 'Team membership limit reached',
			})
		}

		// if storage retention is less than 15m or greater than 72h (3 days)
		if (storageRetentionSeconds < 900 || storageRetentionSeconds > 259200) {
			throw new BadRequestException({
				message:
					'Team storage retention must be between 15 minutes and 72 hours',
			})
		}

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
				storageRetentionSeconds,
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
				role: 'owner' as Role,
			},
		}
	}

	async listUserTeams({ userId }: ListUserTeamsServiceInput) {
		const memberships = await this.prisma.member.findMany({
			where: {
				userId,
			},
			select: {
				team: true,
			},
		})

		return {
			teams: memberships.map((membership) => {
				return {
					...membership.team,
					role:
						membership.team.ownerId === userId ? 'owner' : ('member' as Role),
				}
			}),
		}
	}

	async updateTeam({
		userId,
		teamId,
		name,
		storageRetentionSeconds,
	}: UpdateTeamServiceInput) {
		if (
			storageRetentionSeconds !== undefined &&
			(!Number.isInteger(storageRetentionSeconds) ||
				storageRetentionSeconds < 900 ||
				storageRetentionSeconds > 259200)
		) {
			throw new BadRequestException({
				message:
					'Team storage retention must be between 15 minutes and 72 hours',
			})
		}

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

		const slug = name !== undefined ? slugify(name) : undefined

		if (slug !== undefined && slug !== team.slug) {
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
		}

		const updatedTeam = await this.prisma.team.update({
			where: {
				id: team.id,
			},
			data: {
				name,
				slug,
				storageRetentionSeconds,
			},
		})

		return {
			team: {
				...updatedTeam,
				role: 'owner' as Role,
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
