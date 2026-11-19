import { Module } from "@nestjs/common";
import { TeamsController } from "./teams.controller.js";
import { TeamsService } from "./teams.service.js";
import { DatabaseModule } from "../../database/database.module.js";
import { UsersModule } from "../users/users.module.js";

@Module({
    imports: [DatabaseModule, UsersModule],
    controllers: [TeamsController],
    providers: [TeamsService],
})
export class TeamsModule {}