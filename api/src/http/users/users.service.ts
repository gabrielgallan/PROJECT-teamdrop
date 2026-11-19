import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { User } from '../../database/prisma/client/client.js';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) {}

    async findUserById(userId: string): Promise<User> {
        const user = await this.prisma.user.findUnique({
            where: {
                id: userId
            }
        })
        
        if (!user) {
            throw new NotFoundException({
                message: 'Resource not found',
                statusCode: 404,
            })
        }

        return user
    }
}
