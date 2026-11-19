import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { DatabaseModule } from '../../database/database.module.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  exports: [UsersService],
  controllers: [UsersController],
  providers: [UsersService]
})
export class UsersModule {}
