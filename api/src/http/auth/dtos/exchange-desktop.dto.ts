import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const secretSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)

// Request
const exchangeDesktopSchema = z.object({
  ticket: secretSchema,
  codeVerifier: z
    .string()
    .regex(/^[A-Za-z0-9._~-]{43,128}$/),
}).strict()

class ExchangeDesktopDto extends createZodDto(
  exchangeDesktopSchema,
) {}

// Response
const tokenPairSchema = z.object({
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

const userSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
})

const pendingSchema = z.object({
  status: z.literal('pending'),
})

const completeSchema = tokenPairSchema.extend({
  status: z.literal('complete'),
  user: userSchema,
})

class ExchangePendingResponseDto extends createZodDto(
  pendingSchema,
) {}

class ExchangeCompleteResponseDto extends createZodDto(
  completeSchema,
) {}

// União para tipagem e validação, sem createZodDto()
const exchangeDesktopResponseSchema = z.discriminatedUnion(
  'status',
  [pendingSchema, completeSchema],
)

type ExchangeDesktopResponse = z.infer<
  typeof exchangeDesktopResponseSchema
>

export {
    ExchangeCompleteResponseDto,
    ExchangeDesktopDto,
    type ExchangeDesktopResponse, 
    ExchangePendingResponseDto,
    exchangeDesktopSchema
}