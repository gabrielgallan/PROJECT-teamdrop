import { api } from '../../lib/ky'

export interface StartDesktopLoginRequest {
	codeChallenge: string
}

export interface StartDesktopLoginResponse {
	ticket: string
	authorizationUrl: string
	expiresIn: number
	interval: number
}

export async function startDesktopLogin(
	{ codeChallenge }: StartDesktopLoginRequest,
	signal?: AbortSignal,
) {
	const response = await api
		.post('api/auth/desktop/start', {
			json: { codeChallenge },
			signal,
		})
		.json<StartDesktopLoginResponse>()

	return response
}