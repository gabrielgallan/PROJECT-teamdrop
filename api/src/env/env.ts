import 'dotenv/config'
import z from 'zod'

export const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
	PORT: z.coerce.number().default(8430),
	CORS_ORIGINS: z.string().default('*'),
})

export type Env = z.infer<typeof envSchema>
