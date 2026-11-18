import { Module } from '@nestjs/common'
import { CacheModule } from '../cache/cache.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { EnvModule } from '../env/env.module.js';
import { AuthController } from './auth.controller.js';
import { GoogleOAuthService } from './oauth/google-oauth.service.js';

@Module({
	imports: [EnvModule, DatabaseModule, CacheModule],
	exports: [GoogleOAuthService],
	providers: [GoogleOAuthService],
	controllers: [AuthController]
})
export class AuthModule {}