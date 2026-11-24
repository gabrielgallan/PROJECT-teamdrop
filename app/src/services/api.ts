export const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8430').replace(/\/$/, '')

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
	) {
		super(
			status === 403
				? 'Você não tem permissão para esta ação.'
				: 'Não foi possível concluir a solicitação.',
		)
	}
}

export async function responseData<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const body = await response.json().catch(() => null)
		throw new ApiError(response.status, typeof body?.code === 'string' ? body.code : 'API_ERROR')
	}
	return response.status === 204 ? (undefined as T) : response.json()
}

// Public auth requests never attach a token or trigger a session renewal.
export async function publicRequest<T>(
	path: string,
	body: unknown,
	signal?: AbortSignal,
): Promise<T> {
	const response = await fetch(apiUrl + path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		cache: 'no-store',
		signal: signal
			? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
			: AbortSignal.timeout(15_000),
	})
	return responseData<T>(response)
}

interface AuthAccess {
	getToken: (rejectedToken?: string) => Promise<string>
	onFailure: (error: unknown) => void
}
let authAccess: AuthAccess | undefined
export function configureAuthAccess(access: AuthAccess) {
	authAccess = access
}

export async function apiRequest<T>(path: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
	if (!path.startsWith('/api/') || path.includes('://')) throw new Error('Caminho de API inválido.')
	if (!authAccess) throw new Error('Autenticação não inicializada.')
	const access = authAccess
	const getToken = async (rejected?: string) => {
		try {
			return await access.getToken(rejected)
		} catch (error) {
			access.onFailure(error)
			throw error
		}
	}
	const token = await getToken()
	// Preserve a replayable request body; there is at most one retry, and only on explicit expiry.
	const headers = new Headers(options.headers)
	headers.set('Authorization', `Bearer ${token}`)
	if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type'))
		headers.set('Content-Type', 'application/json')
	const request = new Request(apiUrl + path, { ...options, headers, cache: 'no-store' })
	const retry = request.clone()
	const fetchWithTimeout = (value: Request) =>
		fetch(value, {
			signal: options.signal
				? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs ?? 15_000)])
				: AbortSignal.timeout(options.timeoutMs ?? 15_000),
		})
	const response = await fetchWithTimeout(request)
	if (response.status !== 401) return responseData<T>(response)
	const body = await response
		.clone()
		.json()
		.catch(() => null)
	if (body?.code !== 'ACCESS_TOKEN_EXPIRED') return responseData<T>(response)
	retry.headers.set('Authorization', `Bearer ${await getToken(token)}`)
	return responseData<T>(await fetchWithTimeout(retry))
}
