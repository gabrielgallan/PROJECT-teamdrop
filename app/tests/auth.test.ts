import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn(() => true) }))
vi.mock('@tauri-apps/api/core', () => native)
const session = { user: { id: 'user', email: 'test@example.test', name: null, avatarUrl: null } }

beforeEach(() => {
	vi.resetModules()
	native.invoke.mockReset()
	native.isTauri.mockReturnValue(true)
})
afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

describe('session coordinator', () => {
	it('shares startup across StrictMode mounts and never exposes credentials', async () => {
		let resolve!: (value: unknown) => void
		native.invoke.mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done
				}),
		)
		const auth = await import('../src/services/auth')
		const first = auth.initializeSession()
		const second = auth.initializeSession()
		expect(first).toBe(second)
		expect(native.invoke).toHaveBeenCalledTimes(1)
		expect(auth.getSessionSnapshot().status).toBe('restoring')
		resolve(session)
		await first
		await auth.initializeSession()
		expect(native.invoke).toHaveBeenCalledTimes(1)
		expect(auth.getSessionSnapshot().session).toEqual(session)
		expect(JSON.stringify(auth.getSessionSnapshot())).not.toMatch(/refreshToken|accessToken/)
	})

	it('explains the desktop requirement in browser-only preview', async () => {
		native.isTauri.mockReturnValue(false)
		const auth = await import('../src/services/auth')
		await auth.initializeSession()
		await auth.signInWithGoogle()
		expect(auth.getSessionSnapshot().status).toBe('unsupported')
		expect(native.invoke).not.toHaveBeenCalled()
	})

	it('keeps recovery separate from anonymous and allows retry', async () => {
		native.invoke
			.mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'Sem conexão.' })
			.mockResolvedValueOnce(session)
		const auth = await import('../src/services/auth')
		await auth.initializeSession()
		expect(auth.getSessionSnapshot().status).toBe('recoverable')
		expect(auth.getSessionSnapshot().error).toBe('Sem conexão.')
		await auth.restoreSession()
		expect(auth.getSessionSnapshot().status).toBe('authenticated')
	})

	it('requires explicit login after an uncertain rotation', async () => {
		native.invoke.mockRejectedValue({ code: 'REFRESH_UNCERTAIN', message: 'Entre novamente.' })
		const auth = await import('../src/services/auth')
		await auth.initializeSession()
		expect(auth.getSessionSnapshot().needsLogin).toBe(true)
		expect(native.invoke.mock.calls.map(([command]) => command)).toEqual(['auth_restore_session'])
	})

	it('keeps a session after offline logout and clears only after successful retry', async () => {
		native.invoke
			.mockResolvedValueOnce(session)
			.mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'Sem conexão.' })
			.mockResolvedValueOnce(undefined)
		const auth = await import('../src/services/auth')
		await auth.initializeSession()
		await auth.signOut()
		expect(auth.getSessionSnapshot().session).toEqual(session)
		expect(auth.getSessionSnapshot().error).toBe('Sem conexão.')
		await auth.signOut()
		expect(auth.getSessionSnapshot().status).toBe('anonymous')
		expect(auth.getSessionSnapshot().session).toBeNull()
	})

	it('notifies subscribers and supports unsubscribing', async () => {
		native.invoke.mockResolvedValue(null)
		const auth = await import('../src/services/auth')
		const listener = vi.fn()
		const unsubscribe = auth.subscribeSession(listener)
		await auth.initializeSession()
		expect(listener).toHaveBeenCalled()
		unsubscribe()
		listener.mockClear()
		await auth.restoreSession()
		expect(listener).not.toHaveBeenCalled()
	})
})

describe('login and cancellation', () => {
	async function prepare() {
		vi.useFakeTimers()
		native.invoke.mockImplementation(async (command: string) => {
			if (command === 'auth_restore_session') return null
			if (command === 'auth_cancel_login') return 1
			if (command === 'auth_exchange_login') return { status: 'complete', session }
			return undefined
		})
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				Response.json({
					ticket: 'ticket',
					authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=test',
					expiresIn: 300,
					interval: 2,
				}),
			),
		)
		const auth = await import('../src/services/auth')
		await auth.initializeSession()
		return auth
	}

	it('uses the native exchange and only receives a public session', async () => {
		const auth = await prepare()
		const signingIn = auth.signInWithGoogle()
		await vi.waitFor(() =>
			expect(native.invoke).toHaveBeenCalledWith('open_google_login', expect.anything()),
		)
		await vi.advanceTimersByTimeAsync(2000)
		await signingIn
		expect(auth.getSessionSnapshot().session).toEqual(session)
		expect(native.invoke).toHaveBeenCalledWith(
			'auth_exchange_login',
			expect.objectContaining({
				ticket: 'ticket',
				codeVerifier: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
				generation: 1,
			}),
		)
		expect(fetch).toHaveBeenCalledTimes(1)
	})

	it('polls pending tickets sequentially', async () => {
		const auth = await prepare()
		let count = 0
		native.invoke.mockImplementation(async (command: string) => {
			if (command === 'auth_cancel_login') return 1
			if (command === 'auth_exchange_login')
				return ++count === 1 ? { status: 'pending' } : { status: 'complete', session }
		})
		const signingIn = auth.signInWithGoogle()
		await vi.waitFor(() =>
			expect(native.invoke).toHaveBeenCalledWith('open_google_login', expect.anything()),
		)
		await vi.advanceTimersByTimeAsync(2000)
		expect(auth.getSessionSnapshot().session).toBeNull()
		await vi.advanceTimersByTimeAsync(2000)
		await signingIn
		expect(count).toBe(2)
		expect(auth.getSessionSnapshot().status).toBe('authenticated')
	})

	it('does not accept a late response after cancellation', async () => {
		const auth = await prepare()
		let complete!: (value: unknown) => void
		native.invoke.mockImplementation((command: string) => {
			if (command === 'auth_cancel_login') return Promise.resolve(1)
			if (command === 'auth_exchange_login')
				return new Promise((done) => {
					complete = done
				})
			return Promise.resolve()
		})
		const signingIn = auth.signInWithGoogle()
		await vi.waitFor(() =>
			expect(native.invoke).toHaveBeenCalledWith('open_google_login', expect.anything()),
		)
		await vi.advanceTimersByTimeAsync(2000)
		await auth.cancelLogin()
		complete({ status: 'complete', session })
		await signingIn
		expect(auth.getSessionSnapshot().status).toBe('anonymous')
		expect(auth.getSessionSnapshot().session).toBeNull()
	})

	it('does not repeat an exchange after an uncertain network failure', async () => {
		const auth = await prepare()
		native.invoke.mockImplementation(async (command: string) => {
			if (command === 'auth_cancel_login') return 1
			if (command === 'auth_exchange_login')
				throw { code: 'NETWORK_ERROR', message: 'Resposta perdida.' }
		})
		const signingIn = auth.signInWithGoogle()
		await vi.waitFor(() =>
			expect(native.invoke).toHaveBeenCalledWith('open_google_login', expect.anything()),
		)
		await vi.advanceTimersByTimeAsync(2000)
		await signingIn
		await vi.advanceTimersByTimeAsync(10_000)
		expect(
			native.invoke.mock.calls.filter(([command]) => command === 'auth_exchange_login'),
		).toHaveLength(1)
		expect(auth.getSessionSnapshot().session).toBeNull()
	})
})
