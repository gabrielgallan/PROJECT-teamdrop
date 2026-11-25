import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma/prisma.service.js'
import { AuthenticatedSocket } from '../interfaces/authenticated-socket.interface.js'

@Injectable()
export class RoomsService {
	constructor(private readonly prisma: PrismaService) {}

	teamRoom(teamId: string) {
		return `team:${teamId}`
	}

	async joinUserRooms(socket: AuthenticatedSocket) {
		const memberships = await this.prisma.member.findMany({
			where: {
				userId: socket.data.userId,
			},
			select: {
				teamId: true,
			},
		})

		const rooms = memberships.map(({ teamId }) => this.teamRoom(teamId))

		await socket.join(rooms)
	}
}
