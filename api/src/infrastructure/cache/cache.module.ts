import { Module } from '@nestjs/common'
import { EnvModule } from '../env/env.module.js'
import { CacheService } from './cache.interface.js'
import { RedisService } from './redis/redis.service.js'
import { RedisCacheRepository } from './redis/redis-cache.service.js'

@Module({
	imports: [EnvModule],
	providers: [
		RedisService,
		{
			provide: CacheService,
			useClass: RedisCacheRepository,
		},
	],
	exports: [CacheService],
})
export class CacheModule {}
