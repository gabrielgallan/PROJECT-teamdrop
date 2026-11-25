export interface SessionUser {
	id: string
	name: string | null
	email: string
	avatarUrl: string | null
}

export interface Session {
	user: SessionUser
}

export type AuthStatus =
	| 'restoring'
	| 'anonymous'
	| 'authenticated'
	| 'recoverable'
	| 'unsupported'

export type AuthOperation = 'restore' | 'login' | 'logout'

export interface AuthSnapshot {
	status: AuthStatus
	session: Session | null
	busy: AuthOperation | null
	error: string
	needsLogin: boolean
}

export interface AuthFailure {
	code: string
	message: string
}
