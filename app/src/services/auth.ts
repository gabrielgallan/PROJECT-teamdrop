import { invoke, isTauri } from '@tauri-apps/api/core'
import type { AuthSnapshot, Session } from '../types/auth'
import { authFailure } from '../types/auth'
import { apiUrl, configureAuthAccess, publicRequest } from './api'

let snapshot: AuthSnapshot = {
	status: 'restoring',
	session: null,
	busy: 'restore',
	error: '',
	needsLogin: false,
}
const listeners = new Set<() => void>()
let restorePromise: Promise<void> | null = null
let activeLogin: AbortController | null = null
let cancelPromise: Promise<void> | null = null
let initialized = false

function update(next: Partial<AuthSnapshot>) {
	snapshot = { ...snapshot, ...next }
	for (const listener of listeners) listener()
}
export const getSessionSnapshot = () => snapshot
export function subscribeSession(listener: () => void) {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function failed(error: unknown) {
	const failure = authFailure(error)
	if (failure.code === 'INVALID_REFRESH_TOKEN') {
		update({
			status: 'anonymous',
			session: null,
			busy: null,
			error: failure.message,
			needsLogin: false,
		})
	} else {
		update({
			status: snapshot.session ? 'authenticated' : 'recoverable',
			busy: null,
			error: failure.message,
			needsLogin: ['REFRESH_UNCERTAIN', 'UNAUTHORIZED', 'SESSION_EXISTS'].includes(failure.code),
		})
	}
}

export function restoreSession(): Promise<void> {
	if (restorePromise) return restorePromise
	if (!isTauri()) {
		update({
			status: 'unsupported',
			busy: null,
			session: null,
			error: 'Abra o aplicativo Tauri para entrar e manter sua sessão no Windows.',
		})
		return Promise.resolve()
	}
	update({ status: snapshot.session ? 'authenticated' : 'restoring', busy: 'restore', error: '' })
	restorePromise = invoke<Session | null>('auth_restore_session', { apiBaseUrl: apiUrl })
		.then((session) => {
			initialized = true
			update({
				session,
				status: session ? 'authenticated' : 'anonymous',
				busy: null,
				error: '',
				needsLogin: false,
			})
		})
		.catch((error) => {
			initialized = true
			failed(error)
		})
		.finally(() => {
			restorePromise = null
		})
	return restorePromise
}

export function initializeSession() {
	// StrictMode and remounts subscribe to the same operation, without rotating twice.
	if (initialized) return Promise.resolve()
	return restoreSession()
}

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

export async function signInWithGoogle() {
	if (!isTauri() || activeLogin || snapshot.busy) return
	const controller = new AbortController()
	activeLogin = controller
	update({ busy: 'login', error: '' })
	try {
		if (snapshot.needsLogin) await invoke('auth_logout')
		const generation = await invoke<number>('auth_cancel_login')
		controller.signal.throwIfAborted()
		const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
		const challenge = base64url(
			new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
		)
		const attempt = await publicRequest<{
			ticket: string
			authorizationUrl: string
			expiresIn: number
			interval: number
		}>('/api/auth/desktop/start', { codeChallenge: challenge }, controller.signal)
		controller.signal.throwIfAborted()
		const url = new URL(attempt.authorizationUrl)
		if (
			url.origin !== 'https://accounts.google.com' ||
			url.pathname !== '/o/oauth2/v2/auth' ||
			url.username ||
			url.password
		)
			throw new Error('Invalid OAuth URL')
		await invoke('open_google_login', { url: url.toString() })
		const deadline = Date.now() + Math.min(attempt.expiresIn, 300) * 1000
		while (Date.now() < deadline) {
			await pause(Math.max(2, attempt.interval) * 1000, controller.signal)
			const result = await invoke<{ status: 'pending' } | { status: 'complete'; session: Session }>(
				'auth_exchange_login',
				{ ticket: attempt.ticket, codeVerifier: verifier, generation },
			)
			controller.signal.throwIfAborted()
			if (result.status === 'complete') {
				update({ status: 'authenticated', session: result.session, error: '', needsLogin: false })
				return
			}
		}
		throw { code: 'LOGIN_TIMEOUT', message: 'O tempo para entrar terminou. Tente novamente.' }
	} catch (error) {
		if (!controller.signal.aborted) {
			if (authFailure(error).code === 'LOGIN_TIMEOUT') {
				update({
					status: 'anonymous',
					session: null,
					error: authFailure(error).message,
					needsLogin: false,
				})
			} else failed(error)
		}
	} finally {
		if (controller.signal.aborted && cancelPromise) await cancelPromise
		activeLogin = null
		update({ busy: null })
	}
}

export function cancelLogin(): Promise<void> {
	if (cancelPromise) return cancelPromise
	const controller = activeLogin
	if (!controller) return Promise.resolve()
	controller.abort()
	cancelPromise = invoke('auth_cancel_login')
		.then(() => {
			update({ status: 'anonymous', session: null, error: '', needsLogin: false })
		})
		.catch(failed)
		.finally(() => {
			cancelPromise = null
		})
	return cancelPromise
}

export async function signOut() {
	if (snapshot.busy) return
	update({ busy: 'logout', error: '' })
	try {
		await invoke('auth_logout')
		update({ status: 'anonymous', session: null, busy: null, error: '', needsLogin: false })
	} catch (error) {
		failed(error)
	}
}

configureAuthAccess({
	getToken: (rejectedToken) => invoke<string>('auth_get_access_token', { rejectedToken }),
	onFailure: failed,
})
