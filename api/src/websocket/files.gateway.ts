import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common'
import {
    OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import { PrismaService } from '../database/prisma/prisma.service.js'
import { AccessTokenService } from '../auth/services/access-token.service.js'

@Injectable()
@WebSocketGateway({
  namespace: 'files',
  transports: ['websocket'],
})
export class FilesGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  private server!: Server

  private readonly logger = new Logger(FilesGateway.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessTokenService: AccessTokenService,
  ) {}

    afterInit(server: Server) {
            server.use(async (socket, next) => {
                try {
                    const token = socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '')

                    if (typeof token !== 'string' || !token) {
                        return next(new Error('Unauthorized'))
                    }

                    const payload = await this.accessTokenService.verify(token)

                    socket.data.userId = payload.userId

                    next()
                } catch {
                    next(new Error('Unauthorized'))
                }
        })
    }

    async handleConnection(socket: Socket) {
    try {
        const userId = socket.data.userId as string

        const memberships = await this.prisma.member.findMany({
        where: { userId },
        select: { teamId: true },
        })

        for (const { teamId } of memberships) {
        await socket.join(`team:${teamId}`)
        }

        socket.emit('files.ready')
    } catch {
        socket.disconnect(true)
    }
    }

  fileUploaded(teamId: string, fileId: string) {
    this.server.to(`team:${teamId}`).emit('file.uploaded', {
      teamId,
      fileId,
    })
  }

  fileDeleted(teamId: string, fileId: string) {
    this.server.to(`team:${teamId}`).emit('file.deleted', {
      teamId,
      fileId,
    })
  }
}
