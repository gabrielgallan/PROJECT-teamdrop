import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js';
import { EnvModule } from '../env/env.module.js';
import { GoogleOAuthService } from './oauth/google-oauth.service.js';

@Module({
	imports: [EnvModule, DatabaseModule],
	exports: [GoogleOAuthService],
	providers: [GoogleOAuthService],
})
export class AuthModule {}