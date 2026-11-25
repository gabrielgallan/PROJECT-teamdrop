export const DEFAULT_CACHE_TTL_SECONDS = 300 // 5min

export interface ICacheService {
	set(key: string, value: string, ttlSeconds?: number): Promise<void>
	get(key: string): Promise<string | null>
	getDel(key: string): Promise<string | null>
	delete(key: string): Promise<void>
}

export const CacheService = Symbol.for('cache:ICacheService')
