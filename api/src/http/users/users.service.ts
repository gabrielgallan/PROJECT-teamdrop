import { Injectable, NotFoundException } from '@nestjs/common'
import { User } from '../../database/prisma/client/client.js'
import { PrismaService } from '../../database/prisma/prisma.service.js'

@Injectable()
export class UsersService {
	constructor(private prisma: PrismaService) {}

	async findUserById(userId: string): Promise<User> {
		const user = await this.prisma.user.findUnique({
			where: {
				id: userId,
			},
		})

		if (!user) {
			throw new NotFoundException({
				message: 'User not found',
				statusCode: 404,
			})
		}

		return user
	}
}
