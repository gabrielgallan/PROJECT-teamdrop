import type { QueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import { queryKeys } from '../api/query-keys'
import { recordFileArrival } from './file-arrivals'

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting'

interface FilesRealtimeOptions {
	baseUrl: string
	userId: string
	teamIds: string[]
	client: QueryClient
	getAccessToken: (rejectedToken?: string) => Promise<string>
	isActive: () => boolean
	onAuthFailure: (error: unknown) => void
}

export function connectFilesRealtime(options: FilesRealtimeOptions) {
	let disposed = false
	let renewed = false
	let token: string | undefined
	let rejectedToken: string | undefined
	let retryTimer: ReturnType<typeof setTimeout> | undefined
	const teams = new Set(options.teamIds)
	const active = () => !disposed && options.isActive()
	const status = (value: RealtimeStatus) =>
		options.client.setQueryData(queryKeys.realtime(options.userId), value)
	status('connecting')
	const socket = io(`${options.baseUrl.replace(/\/+$/, '')}/files`, {
		transports: ['websocket'],
		autoConnect: false,
		forceNew: true,
		auth: async (callback) => {
			if (!active()) return
			const rejected = rejectedToken
			rejectedToken = undefined
			try {
				const access = await options.getAccessToken(rejected)
				if (!active()) return
				token = access
				callback({ token: access })
			} catch (error) {
				if (!active()) return
				socket.disconnect()
				if (
					error &&
					typeof error === 'object' &&
					'code' in error &&
					error.code === 'NETWORK_ERROR'
				) {
					status('reconnecting')
					// No namespace handshake occurred; retry fetching the native token.
					rejectedToken = rejected
					retryTimer = setTimeout(() => {
						if (active()) socket.connect()
					}, 2000)
				} else {
					stop()
					options.onAuthFailure(error)
				}
			}
		},
	})

	function stop() {
		disposed = true
		clearTimeout(retryTimer)
		socket.removeAllListeners()
		socket.disconnect()
	}

	socket.on('file:uploaded', (payload: unknown) => {
		if (
			!active() ||
			!payload ||
			typeof payload !== 'object' ||
			!('teamId' in payload) ||
			typeof payload.teamId !== 'string' ||
			!('fileId' in payload) ||
			typeof payload.fileId !== 'string' ||
			!teams.has(payload.teamId)
		)
			return
		recordFileArrival(
			options.client,
			options.userId,
			payload.teamId,
			payload.fileId,
		)
		void options.client.invalidateQueries({
			queryKey: [...queryKeys.team(options.userId, payload.teamId), 'files'],
		})
	})

	socket.on('files.ready', () => {
		if (!active()) return
		status('connected')
		renewed = false
		void options.client.invalidateQueries({
			queryKey: queryKeys.teams(options.userId),
			predicate: (query) => query.queryKey[4] === 'files',
		})
	})

	socket.on('disconnect', () => {
		if (active()) status('reconnecting')
	})

	socket.on('connect_error', (error: Error) => {
		if (!active()) return
		status('reconnecting')
		if (error.message !== 'Unauthorized') return
		if (renewed) {
			stop()
			options.onAuthFailure({
				code: 'UNAUTHORIZED',
				message: 'Entre novamente para continuar.',
			})
			return
		}
		renewed = true
		rejectedToken = token
		socket.connect()
	})

	socket.connect()
	return stop
}
