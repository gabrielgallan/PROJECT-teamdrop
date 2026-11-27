import 'dotenv/config'
import z from 'zod'

export const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
	PORT: z.coerce.number().default(8430),
	CORS_ORIGINS: z.string().default('*'),
	PUBLIC_BASE_URL: z.url().default('http://localhost:8430'),
	DATABASE_URL: z.url(),
	REDIS_URL: z.url(),
	JWT_SECRET: z.string().min(32),
	AZURE_STORAGE_CONTAINER: z.string(),
	AZURE_STORAGE_CONNECTION_STRING: z.string(),
	GOOGLE_OAUTH_CLIENT_ID: z.string(),
	GOOGLE_OAUTH_CLIENT_SECRET: z.string(),
	GOOGLE_OAUTH_CLIENT_REDIRECT_URI: z.string(),
})

export type Env = z.infer<typeof envSchema>
