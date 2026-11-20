import {
	ConflictException,
	ForbiddenException,
	GoneException,
	Injectable,
	NotFoundException,
} from '@nestjs/common'
import { slugify } from '../../common/utils/slugify.js'
import { CryptographyService } from '../../cryptography/cryptography.service.js'
import { PrismaService } from '../../database/prisma/prisma.service.js'
import { UsersService } from '../users/users.service.js'
import { AcceptTeamInviteServiceInput } from './dtos/accept-team-invite.dto.js'
import { CreateTeamServiceInput } from './dtos/create-team.dto.js'
import { CreateTeamInviteServiceInput } from './dtos/create-team-invite.dto.js'
import { ListTeamMembersServiceInput } from './dtos/list-teams-members.dto.js'
import { ListUserTeamsServiceInput } from './dtos/list-user-teams.dto.js'
import { UpdateTeamServiceInput } from './dtos/update-team.dto.js'

interface TeamInviteInput {
	userId: string
	teamSlug: string
}

@Injectable()
export class TeamsService {
	constructor(
		private prisma: PrismaService,
		private usersService: UsersService,
		private cryptoService: CryptographyService,
	) {}

	async createTeam({ name, userId }: CreateTeamServiceInput) {
		await this.usersService.findUserById(userId)

		const slug = slugify(name)

		const teamAlreadyExists = await this.prisma.team.findUnique({
			where: {
				slug,
			},
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
						userId,
					},
				},
			},
		})

		return team
	}

	async listUserTeams({ userId }: ListUserTeamsServiceInput) {
		await this.usersService.findUserById(userId)

		const teams = await this.prisma.team.findMany({
			where: {
				members: {
					some: {
						userId,
					},
				},
			},
		})

		return teams.map((team) => {
			return {
				...team,
				role: team.ownerId === userId ? 'owner' : 'member',
			}
		})
	}

	async updateTeam({ userId, teamSlug, newName }: UpdateTeamServiceInput) {
		await this.usersService.findUserById(userId)

		const team = await this.prisma.team.findUnique({
			where: {
				slug: teamSlug,
			},
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
				slug,
			},
		})

		if (teamAlreadyExists && teamAlreadyExists.id !== team.id) {
			throw new ConflictException({
				message: 'Team name already exists',
				statusCode: 409,
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

		return updatedTeam
	}

	async createTeamInvite({ teamSlug, userId, maxUses, expiresIn }: CreateTeamInviteServiceInput) {
		const team = await this.getOwnedTeam({ userId, teamSlug })

		const token = this.cryptoService.generateToken()

		const tokenHash = this.cryptoService.hashToken(token, 'hex')

		const expiresAt = new Date(Date.now() + expiresIn * 1000)

		await this.prisma.$transaction(async (db) => {
			// Serialize creation, revocation and acceptance for this team.
			await db.$queryRaw`SELECT id FROM teams WHERE id = ${team.id}::uuid FOR UPDATE`
			await db.invite.updateMany({
				where: { teamId: team.id, revokedAt: null },
				data: { revokedAt: new Date() },
			})
			await db.invite.create({
				data: { tokenHash, maxUses, expiresAt, authorId: userId, teamId: team.id },
			})
		})

		return { token, expiresAt, maxUses, uses: 0 }
	}

	async getActiveInvite({ userId, teamSlug }: TeamInviteInput) {
		const team = await this.getOwnedTeam({ userId, teamSlug })
		const invite = await this.prisma.invite.findFirst({
			where: { teamId: team.id, revokedAt: null, expiresAt: { gt: new Date() } },
			select: { id: true, expiresAt: true, maxUses: true, uses: true },
		})
		if (!invite || invite.uses >= invite.maxUses) return { invite: null }

		return { invite }
	}

	async revokeActiveInvite({ userId, teamSlug }: TeamInviteInput) {
		const team = await this.getOwnedTeam({ userId, teamSlug })
		await this.prisma.$transaction(async (db) => {
			await db.$queryRaw`SELECT id FROM teams WHERE id = ${team.id}::uuid FOR UPDATE`
			await db.invite.updateMany({
				where: { teamId: team.id, revokedAt: null },
				data: { revokedAt: new Date() },
			})
		})
	}

	async acceptInvite({ userId, token }: AcceptTeamInviteServiceInput) {
		await this.usersService.findUserById(userId)
		const tokenHash = this.cryptoService.hashToken(token, 'hex')
		const invitation = await this.prisma.invite.findUnique({ where: { tokenHash } })
		if (!invitation) throw new GoneException('Invalid or expired invitation')

		return this.prisma.$transaction(async (db) => {
			await db.$queryRaw`SELECT id FROM teams WHERE id = ${invitation.teamId}::uuid FOR UPDATE`
			const invite = await db.invite.findUnique({ where: { tokenHash } })
			if (!invite || invite.revokedAt || invite.expiresAt.getTime() <= Date.now()) {
				throw new GoneException('Invalid or expired invitation')
			}
			const team = await db.team.findUniqueOrThrow({ where: { id: invite.teamId } })
			const member = await db.member.findUnique({
				where: { teamId_userId: { teamId: team.id, userId } },
			})
			if (!member) {
				if (invite.uses >= invite.maxUses) throw new GoneException('Invitation usage limit reached')
				await db.member.create({ data: { teamId: team.id, userId } })
				await db.invite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } })
			}
			return { ...team, role: team.ownerId === userId ? 'owner' : 'member' }
		})
	}

	private async getOwnedTeam({ userId, teamSlug }: TeamInviteInput) {
		await this.usersService.findUserById(userId)
		const team = await this.prisma.team.findUnique({ where: { slug: teamSlug } })
		if (!team) throw new NotFoundException('Team not found')
		if (team.ownerId !== userId)
			throw new ForbiddenException('User not allowed to manage team invites')
		return team
	}

	async listTeamMembers({ userId, teamSlug }: ListTeamMembersServiceInput) {
		const [user, team] = await this.prisma.$transaction([
			this.prisma.user.findUnique({
				where: {
					id: userId,
				},
			}),
			this.prisma.team.findUnique({
				where: {
					slug: teamSlug,
				},
			}),
		])

		if (!user || !team) {
			throw new NotFoundException({
				message: 'Resource not found',
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

		return members.map((member) => {
			return {
				...member,
				role: member.id === team.ownerId ? 'owner' : 'member',
			}
		})
	}
}
