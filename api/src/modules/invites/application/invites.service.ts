import {
	ForbiddenException,
	GoneException,
	Injectable,
	NotFoundException,
} from '@nestjs/common'
import { CryptographyService } from '../../../common/cryptography/cryptography.service.js'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js'
import { EnvService } from '../../../infrastructure/env/env.service.js'
import { AcceptTeamInviteServiceDto } from '../presentation/dtos/accept-team-invite.dto.js'
import { CreateTeamInviteServiceDto } from '../presentation/dtos/create-team-invite.dto.js'
import { GetInviteDetailsServiceDto } from '../presentation/dtos/get-invite-details.dto.js'
import { RevokeTeamInvitesServiceDto } from '../presentation/dtos/revoke-team-invites.dto.js'

@Injectable()
export class InvitesService {
	constructor(
		private env: EnvService,
		private prisma: PrismaService,
		private cryptoService: CryptographyService,
	) {}

	async createTeamInvite({
		userId,
		teamId,
		maxUses,
		expiresIn,
	}: CreateTeamInviteServiceDto) {
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
				message: 'User membership not found',
			})
		}

		if (membership.team.ownerId !== userId) {
			throw new ForbiddenException({
				message: 'User not allowed to manage team',
			})
		}

		const token = this.cryptoService.generateToken()
		const tokenHash = this.cryptoService.hashToken(token, 'hex')
		const expiresAt = new Date(Date.now() + expiresIn * 1000)

		await this.prisma.$transaction(async (db) => {
			await db.$queryRaw`
				SELECT id FROM teams
				WHERE id = ${membership.teamId}::uuid
				FOR UPDATE
			`

			await db.invite.updateMany({
				where: {
					teamId: membership.teamId,
					revokedAt: null,
				},
				data: {
					revokedAt: new Date(),
				},
			})

			await db.invite.create({
				data: {
					tokenHash,
					maxUses,
					expiresAt,
					authorId: userId,
					teamId: membership.teamId,
				},
			})
		})

		return {
			url: `${this.env.get('PUBLIC_BASE_URL').replace(/\/$/, '')}/invites/${token}`,
		}
	}

	async revokeTeamInvites({ userId, teamId }: RevokeTeamInvitesServiceDto) {
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
				message: 'User membership not found',
			})
		}

		if (membership.team.ownerId !== userId) {
			throw new ForbiddenException({
				message: 'User not allowed to manage team',
			})
		}

		await this.prisma.$transaction(async (db) => {
			await db.$queryRaw`
				SELECT id FROM teams
				WHERE id = ${membership.teamId}::uuid
				FOR UPDATE
			`

			await db.invite.updateMany({
				where: {
					teamId: membership.teamId,
					revokedAt: null,
				},
				data: {
					revokedAt: new Date(),
				},
			})
		})

		return
	}

	async getInviteDetails({ userId, token }: GetInviteDetailsServiceDto) {
		const invite = await this.prisma.invite.findUnique({
			where: {
				tokenHash: this.cryptoService.hashToken(token, 'hex'),
			},
			include: {
				team: {
					select: {
						id: true,
						name: true,
						slug: true,
					},
				},
			},
		})

		if (
			!invite ||
			invite.revokedAt ||
			invite.expiresAt.getTime() <= Date.now()
		) {
			throw new GoneException({
				message: 'Invalid or expired invitation',
			})
		}

		const membership = await this.prisma.member.findUnique({
			where: {
				teamId_userId: {
					teamId: invite.teamId,
					userId,
				},
			},
		})

		if (!membership && invite.uses >= invite.maxUses) {
			throw new GoneException({
				message: 'Invitation usage limit reached',
			})
		}

		return {
			team: invite.team,
			alreadyMember: Boolean(membership),
		}
	}

	async acceptInvite({ userId, token }: AcceptTeamInviteServiceDto) {
		const tokenHash = this.cryptoService.hashToken(token, 'hex')

		return this.prisma.$transaction(async (db) => {
			const inviteRef = await db.invite.findUnique({
				where: {
					tokenHash,
				},
				select: {
					id: true,
					teamId: true,
				},
			})

			if (!inviteRef) {
				throw new GoneException({
					message: 'Invalid or expired invitation',
				})
			}

			await db.$queryRaw`
				SELECT id FROM teams
				WHERE id = ${inviteRef.teamId}::uuid
				FOR UPDATE
			`

			const invite = await db.invite.findUnique({
				where: {
					id: inviteRef.id,
				},
			})

			if (
				!invite ||
				invite.revokedAt ||
				invite.expiresAt.getTime() <= Date.now()
			) {
				throw new GoneException({
					message: 'Invalid or expired invitation',
				})
			}

			const membership = await db.member.findUnique({
				where: {
					teamId_userId: {
						teamId: invite.teamId,
						userId,
					},
				},
			})

			const team = await db.team.findUniqueOrThrow({
				where: { id: invite.teamId },
			})

			const result = {
				team: { ...team, role: team.ownerId === userId ? 'owner' : 'member' },
			}

			if (membership) return result

			if (invite.uses >= invite.maxUses) {
				throw new GoneException({
					message: 'Invitation usage limit reached',
				})
			}

			await db.member.create({
				data: {
					teamId: invite.teamId,
					userId,
				},
			})

			await db.invite.update({
				where: {
					id: invite.id,
				},
				data: {
					uses: {
						increment: 1,
					},
				},
			})

			return result
		})
	}
}
