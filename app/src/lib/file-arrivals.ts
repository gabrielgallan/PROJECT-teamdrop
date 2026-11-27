import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '../api/query-keys'

export interface FileArrival {
	fileId: string
	receivedAt: number
}

export function recordFileArrival(
	client: QueryClient,
	userId: string,
	teamId: string,
	fileId: string,
	now = Date.now(),
) {
	client.setQueryData<FileArrival[]>(
		queryKeys.fileArrivals(userId, teamId),
		(previous = []) => {
			if (previous.some((arrival) => arrival.fileId === fileId)) return previous
			return [
				...previous.filter((arrival) => now - arrival.receivedAt < 60_000),
				{ fileId, receivedAt: now },
			].slice(-100)
		},
	)
}

export interface FileFeedState {
	ids: string[]
	seen: Set<string>
	initialized: boolean
	unread: Set<string>
	highlighted: Set<string>
}

export function createFileFeed(): FileFeedState {
	return {
		ids: [],
		seen: new Set(),
		initialized: false,
		unread: new Set(),
		highlighted: new Set(),
	}
}

export function reconcileFileFeed(
	previous: FileFeedState,
	ids: string[],
	arrivals: FileArrival[],
	nearTop: boolean,
	mountedAt: number,
): FileFeedState {
	const announced = new Set(
		arrivals
			.filter((arrival) => arrival.receivedAt >= mountedAt)
			.map((arrival) => arrival.fileId),
	)
	const added = previous.initialized
		? ids.filter((id) => !previous.seen.has(id) && announced.has(id))
		: []
	const current = new Set(ids)
	return {
		ids,
		seen: new Set([...previous.seen, ...ids]),
		initialized: true,
		unread: new Set([
			...[...previous.unread].filter((id) => current.has(id)),
			...(nearTop ? [] : added),
		]),
		highlighted: new Set([
			...[...previous.highlighted].filter((id) => current.has(id)),
			...(nearTop ? added : []),
		]),
	}
}
