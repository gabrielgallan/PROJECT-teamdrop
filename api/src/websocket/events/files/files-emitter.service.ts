import { Injectable } from '@nestjs/common'
import { WebSocketGatewayService } from '../../websocket.gateway.js'
import { FilesEvents } from './files.events.js'

@Injectable()
export class FilesEmitterService {
	constructor(private readonly gateway: WebSocketGatewayService) {}

	fileUploaded(teamId: string, fileId: string) {
		this.gateway.emitToTeam(teamId, FilesEvents.uploaded, {
			teamId,
			fileId,
		})
	}

	fileDeleted(teamId: string, fileId: string) {
		this.gateway.emitToTeam(teamId, FilesEvents.deleted, {
			teamId,
			fileId,
		})
	}
}
