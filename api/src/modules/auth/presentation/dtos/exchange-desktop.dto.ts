import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { secretSchema, tokenPairSchema } from './token-pair.dto.js'
import { publicUserSchema } from './user.dto.js'

const exchangeDesktopSchema = z
	.object({
		ticket: secretSchema,
		codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
	})
	.strict()

export class ExchangeDesktopDto extends createZodDto(exchangeDesktopSchema) {}

const pendingSchema = z.object({
	status: z.literal('pending'),
})

const completeSchema = tokenPairSchema.extend({
	status: z.literal('complete'),
	user: publicUserSchema,
})

export class ExchangePendingResponseDto extends createZodDto(pendingSchema) {}

export class ExchangeCompleteResponseDto extends createZodDto(completeSchema) {}
