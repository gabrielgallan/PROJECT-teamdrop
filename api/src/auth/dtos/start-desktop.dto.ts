import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const codeChallengeSchema = z
  .string()
  .min(43)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/)

// Request
export const startDesktopLoginSchema = z.object({
  codeChallenge: codeChallengeSchema.meta({
    description: 'BASE64URL(SHA256(desktop verifier))',
  }),
})

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