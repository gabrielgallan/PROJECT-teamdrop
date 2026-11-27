import { createZodDto } from 'nestjs-zod'
import z from 'zod'

const googleCallbackQuerySchema = z.object({
	state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
	code: z.string().min(1).max(4096).optional(),
	error: z.string().min(1).max(256).optional(),
	iss: z.string(),
	scope: z.string(),
	authuser: z.string(),
	prompt: z.string(),
})

export class GoogleCallbackQueryDto extends createZodDto(
	googleCallbackQuerySchema,
) {}
