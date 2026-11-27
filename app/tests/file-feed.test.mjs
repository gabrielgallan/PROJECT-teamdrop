import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { JSDOM } from 'jsdom'
import ts from 'typescript'

registerHooks({
	resolve(specifier, context, next) {
		if (specifier.startsWith('.') && context.parentURL?.includes('/src/')) {
			for (const extension of ['.ts', '.tsx']) {
				const url = new URL(`${specifier}${extension}`, context.parentURL)
				if (existsSync(url)) return { url: url.href, shortCircuit: true }
			}
		}
		return next(specifier, context)
	},
	load(url, context, next) {
		if (/\.tsx?$/.test(url))
			return {
				format: 'module',
				shortCircuit: true,
				source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
					compilerOptions: {
						module: ts.ModuleKind.ESNext,
						jsx: ts.JsxEmit.ReactJSX,
					},
				}).outputText,
			}
		return next(url, context)
	},
})

const { queryKeys } = await import('../src/api/query-keys.ts')
const { createFileFeed, reconcileFileFeed, recordFileArrival } = await import(
	'../src/lib/file-arrivals.ts'
)
const { createToastQueue } = await import('../src/lib/toast-queue.ts')

test('arrival receipts deduplicate local/socket confirmations and stay isolated by account/team', () => {
	const client = new QueryClient()
	recordFileArrival(client, 'one', 'team', 'file', 1000)
	recordFileArrival(client, 'one', 'team', 'file', 1100)
	assert.deepEqual(client.getQueryData(queryKeys.fileArrivals('one', 'team')), [
		{ fileId: 'file', receivedAt: 1000 },
	])
	assert.equal(
		client.getQueryData(queryKeys.fileArrivals('two', 'team')),
		undefined,
	)
	assert.equal(
		client.getQueryData(queryKeys.fileArrivals('one', 'other')),
		undefined,
	)
	recordFileArrival(client, 'one', 'team', 'next', 62000)
	assert.deepEqual(client.getQueryData(queryKeys.fileArrivals('one', 'team')), [
		{ fileId: 'next', receivedAt: 62000 },
	])
	client.clear()
})

test('history, pagination, duplicate refetches and returning to a team are not new arrivals', () => {
	const receipts = [
		{ fileId: 'a', receivedAt: 200 },
		{ fileId: 'new', receivedAt: 300 },
	]
	let state = reconcileFileFeed(createFileFeed(), ['a'], receipts, true, 100)
	assert.equal(state.highlighted.size, 0)
	state = reconcileFileFeed(state, ['a', 'older'], receipts, true, 100)
	assert.equal(state.highlighted.size, 0)
	state = reconcileFileFeed(state, ['new', 'a', 'older'], receipts, true, 100)
	assert.deepEqual([...state.highlighted], ['new'])
	state = { ...state, highlighted: new Set() }
	state = reconcileFileFeed(state, ['new', 'a', 'older'], receipts, true, 100)
	assert.equal(state.highlighted.size, 0)
	const returning = reconcileFileFeed(
		createFileFeed(),
		state.ids,
		receipts,
		true,
		400,
	)
	assert.equal(returning.highlighted.size, 0)
	state = reconcileFileFeed(
		state,
		['second', ...state.ids],
		[{ fileId: 'second', receivedAt: 500 }],
		false,
		100,
	)
	assert.deepEqual([...state.unread], ['second'])
	assert.equal(state.highlighted.size, 0)
})

test('toast queue keeps the visible message and displays pending messages in order', () => {
	const queue = createToastQueue()
	queue.add('one', 'Copied')
	queue.add('one', 'Copied')
	queue.add('two', 'Saved')
	assert.deepEqual(
		queue.getSnapshot().map((item) => item.message),
		['Copied', 'Saved'],
	)
	queue.remove('one')
	assert.equal(queue.getSnapshot()[0].message, 'Saved')
	for (let i = 0; i < 8; i++) queue.add(String(i), String(i))
	assert.equal(queue.getSnapshot().length, 4)
	assert.equal(queue.getSnapshot()[0].id, 'two')
	queue.clear()
	assert.deepEqual(queue.getSnapshot(), [])
})

test('feed preserves the visible row when new files arrive and reveals unread files on request', async (t) => {
	const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' })
	const previous = new Map()
	for (const [key, value] of Object.entries({
		window: dom.window,
		document: dom.window.document,
		HTMLElement: dom.window.HTMLElement,
		IS_REACT_ACT_ENVIRONMENT: true,
	})) {
		previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
		Object.defineProperty(globalThis, key, { value, configurable: true })
	}
	window.matchMedia = () => ({
		matches: false,
		addListener() {},
		removeListener() {},
		addEventListener() {},
		removeEventListener() {},
	})
	const React = await import('react')
	const { createRoot } = await import('react-dom/client')
	const { useFileFeed } = await import('../src/hooks/use-file-feed.ts')
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	const root = createRoot(document.getElementById('root'))
	t.after(async () => {
		await React.act(() => root.unmount())
		client.clear()
		dom.window.close()
		for (const [key, descriptor] of previous) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor)
			else delete globalThis[key]
		}
	})
	const scroll = new Map([['team', 104]])
	let ids = ['a', 'b', 'c', 'd', 'e']
	let feed
	dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
		if (this.tagName === 'SECTION') return { top: 0, bottom: 156 }
		const section = this.closest('section')
		const index = [...section.children].indexOf(this)
		const top = index * 52 - section.scrollTop
		return { top, bottom: top + 52 }
	}
	dom.window.HTMLElement.prototype.scrollTo = function ({ top }) {
		this.scrollTop = top
	}
	function Harness() {
		feed = useFileFeed({
			userId: 'one',
			teamId: 'team',
			ids,
			ready: true,
			scroll,
		})
		return React.createElement(
			'section',
			{ ref: feed.list, onScroll: feed.onScroll, tabIndex: -1 },
			...ids.map((id) =>
				React.createElement('div', { key: id, 'data-file-id': id }, id),
			),
		)
	}
	const render = () =>
		root.render(
			React.createElement(
				QueryClientProvider,
				{ client },
				React.createElement(Harness),
			),
		)
	await React.act(render)
	assert.equal(feed.list.current.scrollTop, 104)
	await React.act(() => recordFileArrival(client, 'one', 'team', 'new'))
	ids = ['new', ...ids]
	await React.act(render)
	assert.equal(feed.list.current.scrollTop, 156)
	assert.equal(feed.unreadCount, 1)
	assert.equal(feed.highlighted.size, 0)
	await React.act(() => feed.reveal())
	assert.equal(feed.list.current.scrollTop, 0)
	assert.equal(feed.unreadCount, 0)
	assert.ok(feed.highlighted.has('new'))
	assert.equal(document.activeElement, feed.list.current)
})
