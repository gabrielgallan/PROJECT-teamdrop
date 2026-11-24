import { isTauri } from '@tauri-apps/api/core'
import { startDesktopLogin } from './api/start-desktop-auth'
import { authCommands } from './auth.commands'
import { authFailure, handleAuthFailure } from './auth.errors'
import { authStore } from './auth.store'

let initialized = false
let restorePromise: Promise<void> | null = null
let activeLogin: AbortController | null = null
let cancelPromise: Promise<void> | null = null

function base64url(bytes: Uint8Array) {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')
}

function pause(ms: number, signal: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		signal.throwIfAborted()

		const abort = () => {
			clearTimeout(timer)
			reject(signal.reason)
		}

		const timer = setTimeout(() => {
			signal.removeEventListener('abort', abort)
			resolve()
		}, ms)

		signal.addEventListener('abort', abort, { once: true })
	})
}

export function initializeSession() {
	if (initialized) return Promise.resolve()

	return restoreSession()
}

export function restoreSession(): Promise<void> {
	if (restorePromise) return restorePromise

	if (!isTauri()) {
		initialized = true

		authStore.update({
			status: 'unsupported',
			session: null,
			busy: null,
			error: 'Abra o aplicativo Tauri para entrar e manter sua sessão no Windows.',
			needsLogin: false,
		})

		return Promise.resolve()
	}

	const { session, busy } = authStore.getSnapshot()

	if (busy === 'login' || busy === 'logout') {
		return Promise.resolve()
	}

	authStore.update({
		status: session ? 'authenticated' : 'restoring',
		busy: 'restore',
		error: '',
	})

	restorePromise = authCommands
		.restoreSession()
		.then((session) => {
			initialized = true

			authStore.update({
				session,
				status: session ? 'authenticated' : 'anonymous',
				busy: null,
				error: '',
				needsLogin: false,
			})
		})
		.catch((error) => {
			initialized = true

			handleAuthFailure(error)
		})
		.finally(() => {
			restorePromise = null
		})

	return restorePromise
}

export async function signInWithGoogle() {
	const { busy, needsLogin } = authStore.getSnapshot()

	if (!isTauri() || activeLogin || busy) return

	const controller = new AbortController()

	activeLogin = controller

	authStore.update({
		busy: 'login',
		error: '',
	})

	try {
		if (needsLogin) {
			await authCommands.logout()
		}

		const generation = await authCommands.cancelLogin()

		controller.signal.throwIfAborted()

		const verifier = base64url(
			crypto.getRandomValues(new Uint8Array(32)),
		)

		const challenge = base64url(
			new Uint8Array(
				await crypto.subtle.digest(
					'SHA-256',
					new TextEncoder().encode(verifier),
				),
			),
		)

		const attempt = await startDesktopLogin(
			{ codeChallenge: challenge },
			controller.signal,
		)

		controller.signal.throwIfAborted()

		const url = new URL(attempt.authorizationUrl)

		if (
			url.origin !== 'https://accounts.google.com' ||
			url.pathname !== '/o/oauth2/v2/auth' ||
			url.username ||
			url.password
		) {
			throw new Error('Invalid OAuth URL')
		}

		await authCommands.openGoogleLogin(url.toString())

		const deadline =
			Date.now() + Math.min(attempt.expiresIn, 300) * 1000

		while (Date.now() < deadline) {
			await pause(
				Math.max(2, attempt.interval) * 1000,
				controller.signal,
			)

			const result = await authCommands.exchangeLogin({
				ticket: attempt.ticket,
				codeVerifier: verifier,
				generation,
			})

			controller.signal.throwIfAborted()

			if (result.status === 'complete') {
				authStore.update({
					status: 'authenticated',
					session: result.session,
					error: '',
					needsLogin: false,
				})

				return
			}
		}

		throw {
			code: 'LOGIN_TIMEOUT',
			message: 'O tempo para entrar terminou. Tente novamente.',
		}
	} catch (error) {
		if (!controller.signal.aborted) {
			const failure = authFailure(error)

			if (failure.code === 'LOGIN_TIMEOUT') {
				authStore.update({
					status: 'anonymous',
					session: null,
					error: failure.message,
					needsLogin: false,
				})
			} else {
				handleAuthFailure(error)
			}
		}
	} finally {
		if (controller.signal.aborted && cancelPromise) {
			await cancelPromise
		}

		activeLogin = null

		authStore.update({
			busy: null,
		})
	}
}

export function cancelLogin(): Promise<void> {
	if (cancelPromise) return cancelPromise

	const controller = activeLogin

	if (!controller) return Promise.resolve()

	controller.abort()

	cancelPromise = authCommands
		.cancelLogin()
		.then(() => {
			authStore.update({
				status: 'anonymous',
				session: null,
				error: '',
				needsLogin: false,
			})
		})
		.catch(handleAuthFailure)
		.finally(() => {
			cancelPromise = null
		})

	return cancelPromise
}

export async function signOut() {
	if (authStore.getSnapshot().busy) return

	authStore.update({
		busy: 'logout',
		error: '',
	})

	try {
		await authCommands.logout()

		authStore.update({
			status: 'anonymous',
			session: null,
			busy: null,
			error: '',
			needsLogin: false,
		})
	} catch (error) {
		handleAuthFailure(error)
	}
}