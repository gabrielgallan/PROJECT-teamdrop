import { isTauri } from '@tauri-apps/api/core'
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'

let pending: string | null = null
const listeners = new Set<() => void>()
let initialization: Promise<void> | undefined

export function parseInviteLink(input: string): string | null {
	try {
		const url = new URL(input.trim())
		if (url.username || url.password || url.hash) return null
		let token: string | null = null
		if (
			url.protocol === 'teamdrop:' &&
			url.hostname === 'invite' &&
			!url.port &&
			(url.pathname === '' || url.pathname === '/') &&
			[...url.searchParams.keys()].length === 1
		) {
			token = url.searchParams.get('token')
		} else if (
			(url.protocol === 'https:' || url.protocol === 'http:') &&
			!url.search
		) {
			token =
				/^\/invites\/([A-Za-z0-9_-]{43})\/?$/.exec(url.pathname)?.[1] ?? null
		}
		return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null
	} catch {
		return null
	}
}
export const getPendingInvite = () => pending
export function subscribeInvites(listener: () => void) {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}
export function setPendingInvite(token: string | null) {
	if (pending === token) return
	pending = token
	for (const listener of listeners) listener()
}
export function initializeInvites(): Promise<void> {
	if (initialization) return initialization
	if (!isTauri()) return Promise.resolve()
	const receive = (urls: string[]) => {
		for (const url of urls) {
			const token = parseInviteLink(url)
			if (token) setPendingInvite(token)
		}
	}
	initialization = (async () => {
		// Subscribe first so links arriving during startup cannot be missed.
		let receivedLive = false
		await onOpenUrl((urls) => {
			receivedLive = true
			receive(urls)
		})
		const urls = await getCurrent()
		if (urls && !receivedLive) receive(urls)
	})().catch(() => {
		initialization = undefined
		// Manual paste remains available if the OS integration cannot initialize.
		console.warn(
			'Could not initialize invitation links; use manual paste in settings.',
		)
	})
	return initialization
}
