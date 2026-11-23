import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { AuthModule } from '../http/auth/auth.module.js'
import { FilesEmitterService } from './events/files/files-emitter.service.js'
import { RoomsService } from './services/rooms.service.js'
import { WebSocketGatewayService } from './websocket.gateway.js'

@Module({
	imports: [DatabaseModule, AuthModule],
	exports: [FilesEmitterService],
	providers: [RoomsService, WebSocketGatewayService, FilesEmitterService],
})
export class WebSocketModule {}
