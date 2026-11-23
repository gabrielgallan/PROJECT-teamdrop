import { ForbiddenException, GoneException, Injectable, NotFoundException } from '@nestjs/common'
import { CryptographyService } from '../../cryptography/cryptography.service.js'
import { PrismaService } from '../../database/prisma/prisma.service.js'
import { EnvService } from '../../env/env.service.js'
import { AcceptTeamInviteServiceDto } from './dtos/accept-team-invite.dto.js'
import { CreateTeamInviteServiceDto } from './dtos/create-team-invite.dto.js'
import { RevokeTeamInvitesServiceDto } from './dtos/revoke-team-invites.dto.js'

@Injectable()
export class InvitesService {
	constructor(
		private env: EnvService,
		private prisma: PrismaService,
		private cryptoService: CryptographyService,
	) {}

	async createTeamInvite({ userId, teamId, maxUses, expiresIn }: CreateTeamInviteServiceDto) {
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
				message: 'User not allowed to manage team',
			})
		}

		const token = this.cryptoService.generateToken()
		const tokenHash = this.cryptoService.hashToken(token, 'hex')
		const expiresAt = new Date(Date.now() + expiresIn * 1000)

		await this.prisma.$transaction(async (db) => {
			await db.$queryRaw`
				SELECT id FROM teams
				WHERE id = ${team.id}::uuid
				FOR UPDATE
			`

			await db.invite.updateMany({
				where: {
					teamId: team.id,
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
					teamId: team.id,
				},
			})
		})

		return {
			url: `${this.env.get('PUBLIC_BASE_URL').replace(/\/$/, '')}/invites/${token}`,
		}
	}

	async revokeTeamInvites({ userId, teamId }: RevokeTeamInvitesServiceDto) {
		const team = await this.prisma.team.findUnique({
			where: {
				id: teamId,
				ownerId: userId,
			},
		})

		if (!team) {
			throw new NotFoundException({
				message: 'Team not found',
			})
		}

		await this.prisma.$transaction(async (db) => {
			await db.$queryRaw`
				SELECT id FROM teams
				WHERE id = ${team.id}::uuid
				FOR UPDATE
			`

			await db.invite.updateMany({
				where: {
					teamId: team.id,
					revokedAt: null,
				},
				data: {
					revokedAt: new Date(),
				},
			})
		})

		return
	}

	async previewInvite({ userId, token }: AcceptTeamInviteServiceDto) {
		const invite = await this.prisma.invite.findUnique({
			where: { 
				tokenHash: this.cryptoService.hashToken(token, 'hex')
			},
			include: { 
				team: { 
					select: { 
						id: true, 
						name: true, 
						slug: true 
					} 
				} 
			},
		})

		if (!invite || invite.revokedAt || invite.expiresAt.getTime() <= Date.now()) {
			throw new GoneException({ 
				message: 'Invalid or expired invitation' 
			})
		}

		const membership = await this.prisma.member.findUnique({
			where: { 
				teamId_userId: { 
					teamId: invite.teamId, 
					userId 
				} 
			},
		})

		if (!membership && invite.uses >= invite.maxUses) {
			throw new GoneException({ 
				message: 'Invitation usage limit reached' 
			})
		}

		return {
			team: invite.team, 
			alreadyMember: Boolean(membership)
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

			if (!invite || invite.revokedAt || invite.expiresAt.getTime() <= Date.now()) {
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

			const team = await db.team.findUniqueOrThrow({ where: { id: invite.teamId } })
			
			const result = { team: { ...team, role: team.ownerId === userId ? 'owner' : 'member' } }
			
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
