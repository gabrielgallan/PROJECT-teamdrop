export const DEFAULT_CACHE_TTL_SECONDS = 300 // 5min

export abstract class CacheRepository {
	abstract set(key: string, value: string, ttlSeconds?: number): Promise<void>
	abstract get(key: string): Promise<string | null>
	abstract getDel(key: string): Promise<string | null>
	abstract delete(key: string): Promise<void>
}
