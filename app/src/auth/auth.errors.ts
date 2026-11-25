import { authStore } from './auth.store'
import type { AuthFailure } from './auth.types'

export function authFailure(error: unknown): AuthFailure {
	if (
		error &&
		typeof error === 'object' &&
		'code' in error &&
		'message' in error &&
		typeof error.code === 'string' &&
		typeof error.message === 'string'
	) {
		return {
			code: error.code,
			message: error.message,
		}
	}

	return {
		code: 'NETWORK_ERROR',
		message:
			'Não foi possível concluir a solicitação. Verifique sua conexão e tente novamente.',
	}
}

export function handleAuthFailure(error: unknown) {
	const failure = authFailure(error)
	const { session } = authStore.getSnapshot()

	if (failure.code === 'INVALID_REFRESH_TOKEN') {
		authStore.update({
			status: 'anonymous',
			session: null,
			busy: null,
			error: failure.message,
			needsLogin: false,
		})

		return
	}

	authStore.update({
		status: session ? 'authenticated' : 'recoverable',
		busy: null,
		error: failure.message,
		needsLogin: [
			'REFRESH_UNCERTAIN',
			'UNAUTHORIZED',
			'SESSION_EXISTS',
		].includes(failure.code),
	})
}
