import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { secretSchema, TokenPairDto } from './token-pair.dto.js'

const refreshTokenSchema = z
	.object({
		refreshToken: secretSchema,
	})
	.strict()

export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}

export class RefreshTokenResponseDto extends TokenPairDto {}
