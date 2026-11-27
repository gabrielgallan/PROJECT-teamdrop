import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const secretSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)

export const tokenPairSchema = z.object({
	accessToken: z.string().meta({
		description: 'JWT valid for at most 15 minutes',
	}),
	refreshToken: z.string().meta({
		description: 'Rotating opaque secret; store in the OS credential vault',
	}),
	tokenType: z.literal('Bearer'),
	expiresIn: z.number().int().max(900),
	refreshExpiresAt: z.iso.datetime().meta({
		description: 'Fixed session expiration, 30 days after login',
	}),
})

export class TokenPairDto extends createZodDto(tokenPairSchema) {}
