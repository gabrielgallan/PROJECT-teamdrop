import { invoke } from '@tauri-apps/api/core'
import type { Session } from '../auth/auth.types'
import { env } from '../env'

export interface ExchangeLoginRequest {
	ticket: string
	codeVerifier: string
	generation: number
}

export type ExchangeLoginResponse =
	| { status: 'pending' }
	| { status: 'complete'; session: Session }

export const authCommands = {
	async restoreSession() {
		const response = await invoke<Session | null>('auth_restore_session', {
			apiBaseUrl: env.VITE_API_URL,
		})

		return response
	},

	async getAccessToken(rejectedToken?: string) {
		const response = await invoke<string>('auth_get_access_token', {
			rejectedToken,
		})

		return response
	},

	async exchangeLogin({
		ticket,
		codeVerifier,
		generation,
	}: ExchangeLoginRequest) {
		const response = await invoke<ExchangeLoginResponse>(
			'auth_exchange_login',
			{ ticket, codeVerifier, generation },
		)

		return response
	},

	async openGoogleLogin(url: string) {
		await invoke('open_google_login', { url })
	},

	async cancelLogin() {
		const generation = await invoke<number>('auth_cancel_login')

		return generation
	},

	async logout() {
		await invoke('auth_logout')
	},
}
