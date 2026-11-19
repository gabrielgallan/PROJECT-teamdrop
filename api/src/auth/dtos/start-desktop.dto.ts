import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const secretSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/)

// Request
export const startDesktopLoginSchema = z.object({
  codeChallenge: secretSchema.meta({
    description: 'BASE64URL(SHA256(desktop verifier))',
  }),
}).strict()

export class StartDesktopLoginDto extends createZodDto(
  startDesktopLoginSchema,
) {}

// Response
export const startDesktopLoginResponseSchema = z.object({
  ticket: z.string(),
  authorizationUrl: z.url(),
  expiresIn: z.number().int().meta({ example: 300 }),
  interval: z.number().int().meta({ example: 2 }),
})

export class StartDesktopLoginResponseDto extends createZodDto(
  startDesktopLoginResponseSchema,
) {}