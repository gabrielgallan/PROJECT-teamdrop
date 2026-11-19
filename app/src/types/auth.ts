export interface SessionUser {
	id: string
	name: string | null
	email: string
	avatarUrl: string | null
}

export interface Session {
	user: SessionUser
}

export type AuthStatus = 'restoring' | 'anonymous' | 'authenticated' | 'recoverable' | 'unsupported'

export interface AuthSnapshot {
	status: AuthStatus
	session: Session | null
	busy: 'restore' | 'login' | 'logout' | null
	error: string
	needsLogin: boolean
}

export interface AuthFailure {
	code: string
	message: string
}

export function authFailure(error: unknown): AuthFailure {
	if (
		error &&
		typeof error === 'object' &&
		'code' in error &&
		'message' in error &&
		typeof error.code === 'string' &&
		typeof error.message === 'string'
	) {
		return { code: error.code, message: error.message }
	}
	return {
		code: 'NETWORK_ERROR',
		message: 'Não foi possível concluir a solicitação. Verifique sua conexão e tente novamente.',
	}
}
