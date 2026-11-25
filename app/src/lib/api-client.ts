import ky, { isHTTPError } from 'ky'
import { ApiError } from './api-error'

interface ApiClientOptions {
	baseUrl: string
	getAccessToken: (rejectedToken?: string) => Promise<string>
	getSession: () => unknown
	canRequest: () => boolean
	onAuthFailure: (error: unknown) => void
	fetch?: typeof globalThis.fetch
}

function errorCode(value: unknown) {
	return value &&
		typeof value === 'object' &&
		'code' in value &&
		typeof value.code === 'string'
		? value.code
		: undefined
}

// Keep this factory independent of React/Tauri so the HTTP contract can be tested.
export function createApiClient(config: ApiClientOptions) {
	const fetcher = config.fetch ?? globalThis.fetch.bind(globalThis)
	return ky.create({
		baseUrl: `${config.baseUrl.replace(/\/+$/, '')}/`,
		timeout: 15_000,
		retry: 0,
		cache: 'no-store',
		fetch: fetcher,
		hooks: {
			init: [
				(options) => {
					options.context = {
						...options.context,
						requestTimeout: options.timeout ?? 15_000,
					}
				},
			],
			beforeRequest: [
				async ({ request, options }) => {
					if (options.context.public === true) {
						request.headers.delete('Authorization')
						return
					}
					const session = config.getSession()
					const assertActive = () => {
						request.signal.throwIfAborted()
						if (
							!session ||
							config.getSession() !== session ||
							!config.canRequest()
						) {
							throw new DOMException('Session changed', 'AbortError')
						}
					}
					const getToken = async (rejected?: string) => {
						assertActive()
						try {
							const token = await config.getAccessToken(rejected)
							assertActive()
							return token
						} catch (error) {
							assertActive()
							config.onAuthFailure(error)
							throw error
						}
					}
					request.headers.set('Authorization', `Bearer ${await getToken()}`)
					// With generic retries disabled, keep our own unread body for auth replay.
					options.context.auth = {
						assertActive,
						getToken,
						replay: request.clone(),
					}
				},
			],
			afterResponse: [
				async ({ request, options, response }) => {
					if (options.context.public === true) return
					const auth = options.context.auth as {
						assertActive: () => void
						getToken: (rejected?: string) => Promise<string>
						replay: Request
					}
					auth.assertActive()
					if (response.status !== 401) return
					const body = await response
						.clone()
						.json()
						.catch(() => null)
					if (errorCode(body) === 'ACCESS_TOKEN_EXPIRED') {
						const rejected = request.headers.get('Authorization')?.slice(7)
						auth.replay.headers.set(
							'Authorization',
							`Bearer ${await auth.getToken(rejected)}`,
						)
						// A separate raw request permits one auth replay with generic retries disabled.
						const renewed = await ky(auth.replay, {
							fetch: fetcher,
							retry: 0,
							timeout: options.context.requestTimeout as number | false,
							signal: request.signal,
							throwHttpErrors: false,
						})
						auth.assertActive()
						if (renewed.status === 401)
							config.onAuthFailure({
								code: 'UNAUTHORIZED',
								message: 'Entre novamente para continuar.',
							})
						return renewed
					}
					config.onAuthFailure({
						code: 'UNAUTHORIZED',
						message: 'Entre novamente para continuar.',
					})
				},
			],
			beforeError: [
				({ error }) => {
					if (!isHTTPError(error)) return error
					return new ApiError(error.response.status, errorCode(error.data))
				},
			],
		},
	})
}
