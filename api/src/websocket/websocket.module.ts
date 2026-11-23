import { Module } from "@nestjs/common";
import { FilesGateway } from "./files.gateway.js";
import { DatabaseModule } from "../database/database.module.js";
import { AuthModule } from "../auth/auth.module.js";

@Module({
    imports: [DatabaseModule, AuthModule],
    exports: [FilesGateway],
    providers: [FilesGateway]
})
export class WebSocketModule {}