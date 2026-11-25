import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { secretSchema } from './exchange-desktop.dto.js'

// Request
export const refreshTokenSchema = z
	.object({
		refreshToken: secretSchema,
	})
	.strict()

export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}

// Response
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

export class RefreshTokenResponseDto extends createZodDto(tokenPairSchema) {}
