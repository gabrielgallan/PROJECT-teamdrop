import { useQuery } from '@tanstack/react-query'
import { useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { queryKeys } from '../api/query-keys'
import {
	createFileFeed,
	type FileArrival,
	reconcileFileFeed,
} from '../lib/file-arrivals'

interface FileFeedOptions {
	userId: string
	teamId: string
	ids: string[]
	ready: boolean
	scroll: Map<string, number>
}

export function useFileFeed({
	userId,
	teamId,
	ids,
	ready,
	scroll,
}: FileFeedOptions) {
	const { data: arrivals = [] } = useQuery({
		queryKey: queryKeys.fileArrivals(userId, teamId),
		queryFn: (): FileArrival[] => [],
		enabled: false,
		gcTime: 60_000,
	})
	const reducedMotion = useReducedMotion()
	const list = useRef<HTMLElement>(null)
	const [mountedAt] = useState(Date.now)
	const [nearTop, setNearTop] = useState(() => (scroll.get(teamId) ?? 0) <= 24)
	const [feed, setFeed] = useState(createFileFeed)
	const signature = JSON.stringify(ids)
	if (ready && (!feed.initialized || signature !== JSON.stringify(feed.ids))) {
		setFeed(reconcileFileFeed(feed, ids, arrivals, nearTop, mountedAt))
	}

	const anchor = useRef<{ id: string; offset: number } | null>(null)
	const restored = useRef(false)
	function rememberAnchor() {
		const element = list.current
		if (!element) return
		const top = element.getBoundingClientRect().top
		const first = [
			...element.querySelectorAll<HTMLElement>('[data-file-id]'),
		].find((row) => row.getBoundingClientRect().bottom > top)
		anchor.current = first
			? {
					id: first.dataset.fileId ?? '',
					offset: first.getBoundingClientRect().top - top,
				}
			: null
	}
	useLayoutEffect(() => {
		const element = list.current
		if (!element) return
		if (!restored.current) {
			element.scrollTop = scroll.get(teamId) ?? 0
			restored.current = true
		} else if (nearTop) {
			element.scrollTop = 0
		} else if (anchor.current) {
			const previous = anchor.current
			const row = [
				...element.querySelectorAll<HTMLElement>('[data-file-id]'),
			].find((item) => item.dataset.fileId === previous.id)
			if (row) {
				element.scrollTop +=
					row.getBoundingClientRect().top -
					element.getBoundingClientRect().top -
					previous.offset
			}
		}
		scroll.set(teamId, element.scrollTop)
		rememberAnchor()
	}, [signature, teamId, scroll])

	useEffect(() => {
		if (!feed.highlighted.size) return
		const timer = setTimeout(() => {
			setFeed((previous) => ({ ...previous, highlighted: new Set() }))
		}, 1800)
		return () => clearTimeout(timer)
	}, [feed.highlighted])

	function reveal() {
		setFeed((previous) => ({
			...previous,
			highlighted: new Set([...previous.highlighted, ...previous.unread]),
			unread: new Set(),
		}))
		list.current?.focus({ preventScroll: true })
		list.current?.scrollTo({
			top: 0,
			behavior: reducedMotion ? 'instant' : 'smooth',
		})
	}

	return {
		list,
		nearTop,
		highlighted: feed.highlighted,
		unreadCount: feed.unread.size,
		reveal,
		onScroll() {
			const element = list.current
			if (!element) return
			scroll.set(teamId, element.scrollTop)
			rememberAnchor()
			const atTop = element.scrollTop <= 24
			setNearTop(atTop)
			if (atTop && feed.unread.size) {
				setFeed((previous) => ({
					...previous,
					highlighted: new Set([...previous.highlighted, ...previous.unread]),
					unread: new Set(),
				}))
			}
		},
	}
}
