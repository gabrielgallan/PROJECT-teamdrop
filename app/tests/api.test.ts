import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, configureAuthAccess, publicRequest } from '../src/services/api'

const token = vi.fn()
const failure = vi.fn()
beforeEach(() => {
	token.mockReset().mockResolvedValue('initial-jwt')
	failure.mockReset()
	configureAuthAccess({ getToken: token, onFailure: failure })
})
afterEach(() => vi.unstubAllGlobals())

describe('authenticated HTTP requests', () => {
	it('attaches access token and preserves the response', async () => {
		const fetcher = vi.fn(async () => Response.json({ ok: true }))
		vi.stubGlobal('fetch', fetcher)
		expect(await apiRequest('/api/example')).toEqual({ ok: true })
		expect((fetcher.mock.calls[0][0] as unknown as Request).headers.get('Authorization')).toBe(
			'Bearer initial-jwt',
		)
	})

	it('renews and retries an expired request once, preserving its body', async () => {
		token.mockResolvedValueOnce('expired-jwt').mockResolvedValueOnce('new-jwt')
		const requests: Request[] = []
		vi.stubGlobal(
			'fetch',
			vi.fn(async (request: Request) => {
				requests.push(request)
				return requests.length === 1
					? Response.json({ code: 'ACCESS_TOKEN_EXPIRED' }, { status: 401 })
					: Response.json({ ok: true })
			}),
		)
		await apiRequest('/api/example', { method: 'POST', body: JSON.stringify({ name: 'test' }) })
		expect(token.mock.calls).toEqual([[undefined], ['expired-jwt']])
		expect(requests).toHaveLength(2)
		expect(requests[1].headers.get('Authorization')).toBe('Bearer new-jwt')
		expect(await requests[0].text()).toBe(await requests[1].text())
	})

	it('stops after one retry even if the server still returns expired', async () => {
		const fetcher = vi.fn(async () =>
			Response.json({ code: 'ACCESS_TOKEN_EXPIRED' }, { status: 401 }),
		)
		vi.stubGlobal('fetch', fetcher)
		await expect(apiRequest('/api/example')).rejects.toMatchObject({
			status: 401,
			code: 'ACCESS_TOKEN_EXPIRED',
		})
		expect(fetcher).toHaveBeenCalledTimes(2)
	})

	it.each([401, 403, 500])(
		'does not renew or clear session on ordinary HTTP %i',
		async (status) => {
			vi.stubGlobal(
				'fetch',
				vi.fn(async () => Response.json({ code: 'OTHER_ERROR' }, { status })),
			)
			await expect(apiRequest('/api/example')).rejects.toMatchObject({ status })
			expect(token).toHaveBeenCalledTimes(1)
			expect(failure).not.toHaveBeenCalled()
		},
	)

	it('preserves session when the resource request fails to connect', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('Network failure')
			}),
		)
		await expect(apiRequest('/api/example')).rejects.toThrow('Network failure')
		expect(failure).not.toHaveBeenCalled()
	})

	it('reports native refresh failure without sending the resource request', async () => {
		token.mockRejectedValue({ code: 'INVALID_REFRESH_TOKEN', message: 'Entre novamente.' })
		const fetcher = vi.fn()
		vi.stubGlobal('fetch', fetcher)
		await expect(apiRequest('/api/example')).rejects.toMatchObject({
			code: 'INVALID_REFRESH_TOKEN',
		})
		expect(failure).toHaveBeenCalledOnce()
		expect(fetcher).not.toHaveBeenCalled()
	})

	it('shares native coordination across concurrent requests', async () => {
		const fetcher = vi.fn(async () => Response.json({ ok: true }))
		vi.stubGlobal('fetch', fetcher)
		await Promise.all(Array.from({ length: 8 }, () => apiRequest('/api/example')))
		expect(fetcher).toHaveBeenCalledTimes(8)
		expect(token.mock.calls.every(([rejected]) => rejected === undefined)).toBe(true)
	})

	it('public requests never ask for a token', async () => {
		const fetcher = vi.fn(async () => Response.json({ ticket: 'ticket' }))
		vi.stubGlobal('fetch', fetcher)
		await publicRequest('/api/auth/desktop/start', { codeChallenge: 'challenge' })
		expect(token).not.toHaveBeenCalled()
		const options = fetcher.mock.calls[0][1] as unknown as RequestInit
		expect(new Headers(options.headers).has('Authorization')).toBe(false)
	})

	it('does not allow absolute API request paths', async () => {
		await expect(apiRequest('https://example.com/api/resource')).rejects.toThrow(
			'Caminho de API inválido',
		)
		expect(token).not.toHaveBeenCalled()
	})
})
