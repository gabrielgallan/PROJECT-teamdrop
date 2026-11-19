import type { Request } from 'express'

export interface AuthenticatedUser {
	userId: string
	sessionId: string
}

export interface AccessTokenClaims {
	sub: string
	sid: string
	iss: string
	aud: string
	iat: number
	exp: number
}

export type AuthenticatedRequest = Request & { user: AuthenticatedUser }

export interface TokenPair {
	accessToken: string
	refreshToken: string
	tokenType: 'Bearer'
	expiresIn: number
	refreshExpiresAt: string
}
