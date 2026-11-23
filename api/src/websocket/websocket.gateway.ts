import { Injectable } from '@nestjs/common'
import {
	OnGatewayConnection,
	OnGatewayInit,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets'
import type { Namespace } from 'socket.io'
import { AccessTokenService } from '../http/auth/services/access-token.service.js'
import { AuthenticatedSocket } from './interfaces/authenticated-socket.interface.js'
import { RoomsService } from './services/rooms.service.js'

@Injectable()
@WebSocketGateway({
	namespace: 'files',
	transports: ['websocket'],
})
export class WebSocketGatewayService implements OnGatewayInit, OnGatewayConnection {
	@WebSocketServer()
	private server!: Namespace

	constructor(
		private readonly accessTokenService: AccessTokenService,
		private readonly roomsService: RoomsService,
	) {}

	afterInit(server: Namespace) {
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

	async handleConnection(socket: AuthenticatedSocket) {
		try {
			await this.roomsService.joinUserRooms(socket)

			socket.emit('files.ready')
		} catch {
			socket.disconnect(true)
		}
	}

	emitToTeam<T>(teamId: string, event: string, payload: T) {
		this.server.to(this.roomsService.teamRoom(teamId)).emit(event, payload)
	}
}
