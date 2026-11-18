import { Inject, Injectable } from '@nestjs/common';
import { CacheRepository, DEFAULT_CACHE_TTL_SECONDS } from '../cache.interface.js';
import { RedisService } from './redis.service.js';

@Injectable()
export class RedisCacheRepository implements CacheRepository {
	constructor(@Inject(RedisService) private redis: RedisService) {}

	async set(
		key: string,
		value: string,
		ttlSeconds: number = DEFAULT_CACHE_TTL_SECONDS,
	): Promise<void> {
		await this.redis.set(key, value, 'EX', ttlSeconds);
	}

	get(key: string): Promise<string | null> {
		return this.redis.get(key);
	}

	async delete(key: string): Promise<void> {
		await this.redis.del(key);
	}

	async getDel(key: string): Promise<string | null> {
		return this.redis.getdel(key)
	}
}