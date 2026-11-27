import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { JSDOM } from 'jsdom'
import ts from 'typescript'

registerHooks({
	resolve(specifier, context, next) {
		if (context.parentURL?.includes('/src/')) {
			const mocks = {
				'./use-auth':
					'export const useAuth = () => globalThis.autoDropTest.auth',
				'../hooks/use-auth':
					'export const useAuth = () => globalThis.autoDropTest.auth',
				'../auth/auth.store':
					'export const authStore = {getSnapshot: () => globalThis.autoDropTest.auth}',
				'../api/files/upload-team-file':
					'export const uploadTeamFile = (...args) => globalThis.autoDropTest.send(...args)',
				'../api/files/get-file-url':
					'export const getFileUrl = (...args) => globalThis.autoDropTest.getUrl(...args)',
				'../desktop/files.commands':
					'export const uploadContent = async (item) => item.file',
				'../desktop/app.commands':
					'export const copyText = (...args) => globalThis.autoDropTest.copy(...args); export const isDesktop = () => true',
				'../desktop/preferences.commands':
					'export const preferencesCommands = {read: (...args) => globalThis.autoDropTest.preferences.read(...args), write: (...args) => globalThis.autoDropTest.preferences.write(...args)}',
			}
			if (mocks[specifier])
				return {
					url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`,
					shortCircuit: true,
				}
			if (specifier.startsWith('.')) {
				for (const extension of ['.ts', '.tsx']) {
					const url = new URL(`${specifier}${extension}`, context.parentURL)
					if (existsSync(url)) return { url: url.href, shortCircuit: true }
				}
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

const { createPreferencesStorage } = await import(
	'../src/lib/user-preferences.ts'
)

function memoryStore() {
	let disk = { version: 1, users: {} }
	let memory = structuredClone(disk)
	let failSave = false
	return {
		get: async (key) => structuredClone(memory[key]),
		set: async (key, value) => {
			memory[key] = structuredClone(value)
		},
		save: async () => {
			if (failSave) throw new Error('disk unavailable')
			disk = structuredClone(memory)
		},
		restart: () => {
			memory = structuredClone(disk)
		},
		fail: (value) => {
			failSave = value
		},
	}
}

test('preferences persist per user, serialize writes and roll back a failed save', async () => {
	const store = memoryStore()
	let preferences = createPreferencesStorage(async () => store)
	assert.deepEqual(await preferences.read('one'), { autoDrop: false })
	await Promise.all([
		preferences.write('one', { autoDrop: true }),
		preferences.write('two', { autoDrop: false }),
	])
	store.restart()
	preferences = createPreferencesStorage(async () => store)
	assert.deepEqual(await preferences.read('one'), { autoDrop: true })
	assert.deepEqual(await preferences.read('two'), { autoDrop: false })
	store.fail(true)
	await assert.rejects(preferences.write('two', { autoDrop: true }))
	assert.deepEqual(await preferences.read('two'), { autoDrop: false })
	store.fail(false)
	await preferences.write('one', { autoDrop: false })
	store.restart()
	assert.deepEqual(await preferences.read('two'), { autoDrop: false })
	await store.set('version', 99)
	await assert.rejects(preferences.read('one'))
})

async function setup(t, mode = true, preferencesHook = false) {
	const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' })
	const original = new Map()
	for (const [key, value] of Object.entries({
		window: dom.window,
		document: dom.window.document,
		IS_REACT_ACT_ENVIRONMENT: true,
	})) {
		original.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
		Object.defineProperty(globalThis, key, { value, configurable: true })
	}
	const React = await import('react')
	const { createRoot } = await import('react-dom/client')
	const { useUploadQueue } = await import('../src/hooks/use-upload-queue.ts')
	const { useUserPreferences } = await import(
		'../src/hooks/use-user-preferences.ts'
	)
	const user = { id: 'user-one' }
	const session = { user }
	const sends = [],
		urls = [],
		copies = []
	const state = {
		auth: {
			user,
			session,
			canQuery: true,
			status: 'authenticated',
			needsLogin: false,
			busy: null,
		},
		send: async ({ file }) => {
			sends.push(file.name)
			return { id: `uploaded-${file.name}` }
		},
		getUrl: async ({ fileId, type }) => {
			urls.push({ fileId, type })
			return { url: `https://storage.example/${fileId}` }
		},
		copy: async (text) => {
			copies.push(text)
		},
		preferences: createPreferencesStorage(async () => memoryStore()),
	}
	globalThis.autoDropTest = state
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	})
	const root = createRoot(document.getElementById('root'))
	let queue, prefs
	function Harness() {
		prefs = useUserPreferences()
		queue = useUploadQueue(
			'team-one',
			preferencesHook ? prefs.ready && prefs.autoDrop : mode,
		)
		return null
	}
	const render = async () =>
		React.act(async () => {
			root.render(
				React.createElement(
					React.StrictMode,
					null,
					React.createElement(
						QueryClientProvider,
						{ client },
						React.createElement(Harness),
					),
				),
			)
			await delay(20)
		})
	const act = async (callback) =>
		React.act(async () => {
			await callback()
			await delay(20)
		})
	t.after(async () => {
		await React.act(() => root.unmount())
		client.clear()
		dom.window.close()
		delete globalThis.autoDropTest
		for (const [key, descriptor] of original) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor)
			else delete globalThis[key]
		}
	})
	await render()
	return {
		state,
		sends,
		urls,
		copies,
		client,
		act,
		render,
		get queue() {
			return queue
		},
		get prefs() {
			return prefs
		},
		setMode(value) {
			mode = value
		},
	}
}

const items = (...names) =>
	names.map((name) => ({
		id: name,
		name,
		kind: 'document',
		file: new File(['content'], name),
	}))

test('auto-drop uploads once in StrictMode and copies only the last link', async (t) => {
	const f = await setup(t)
	await f.act(() => {
		f.queue.prepare(items('a', 'b'))
		f.queue.prepare(items('ignored'))
	})
	assert.deepEqual(f.sends, ['a', 'b'])
	assert.deepEqual(f.urls, [{ fileId: 'uploaded-b', type: 'preview' }])
	assert.deepEqual(f.copies, ['https://storage.example/uploaded-b'])
	assert.equal(f.queue.pending.length, 0)
	assert.equal(f.queue.isUploading(), false)
})

test('manual selection stays manual when the preference changes before sharing', async (t) => {
	const f = await setup(t, false)
	await f.act(() => f.queue.prepare(items('manual')))
	f.setMode(true)
	await f.render()
	assert.deepEqual(f.sends, [])
	await f.act(() => f.queue.share())
	assert.deepEqual(f.sends, ['manual'])
	assert.deepEqual(f.urls, [])
	assert.deepEqual(f.copies, [])
})

test('partial upload failure preserves only unconfirmed files and blocks new batches', async (t) => {
	const f = await setup(t)
	const send = f.state.send
	f.state.send = async (request) => {
		if (request.file.name === 'b') throw new Error('offline')
		return send(request)
	}
	await f.act(() => f.queue.prepare(items('a', 'b', 'c')))
	assert.equal(f.queue.blocked, true)
	assert.deepEqual(
		f.queue.pending.map((item) => item.id),
		['b', 'c'],
	)
	assert.deepEqual(f.copies, [])
	await f.act(() => f.queue.prepare(items('ignored')))
	f.state.send = send
	await f.act(() => f.queue.retry())
	assert.deepEqual(f.sends, ['a', 'b', 'c'])
	assert.deepEqual(f.urls, [{ fileId: 'uploaded-c', type: 'preview' }])
	assert.equal(f.queue.blocked, false)
})

test('URL and clipboard failures retry only link generation and copy', async (t) => {
	const f = await setup(t)
	const getUrl = f.state.getUrl,
		copy = f.state.copy
	f.state.getUrl = async () => {
		throw new Error('URL unavailable')
	}
	await f.act(() => f.queue.prepare(items('a')))
	assert.equal(f.queue.pending.length, 0)
	assert.equal(f.queue.blocked, true)
	assert.equal(f.queue.retryLabel, 'Copiar link')
	f.state.getUrl = getUrl
	f.state.copy = async () => {
		throw new Error('clipboard unavailable')
	}
	await f.act(() => f.queue.retry())
	assert.equal(f.queue.blocked, true)
	assert.deepEqual(f.sends, ['a'])
	f.state.copy = copy
	await f.act(() => f.queue.retry())
	assert.deepEqual(f.sends, ['a'])
	assert.deepEqual(f.copies, ['https://storage.example/uploaded-a'])
	assert.equal(f.queue.blocked, false)
})

test('logout during URL generation prevents a late clipboard write', async (t) => {
	const f = await setup(t)
	let resolveUrl
	f.state.getUrl = () =>
		new Promise((resolve) => {
			resolveUrl = resolve
		})
	await f.act(() => f.queue.prepare(items('a')))
	f.state.auth = { ...f.state.auth, canQuery: false, busy: 'logout' }
	await f.render()
	await f.act(() => resolveUrl({ url: 'https://storage.example/late' }))
	assert.deepEqual(f.copies, [])
})

test('late preferences from another account do not enable auto-drop for the current user', async (t) => {
	const f = await setup(t, false, true)
	let resolveFirst
	f.state.preferences = {
		read: (userId) =>
			userId === 'user-one'
				? new Promise((resolve) => {
						resolveFirst = resolve
					})
				: Promise.resolve({ autoDrop: false }),
		write: async () => {},
	}
	await f.act(() => {
		f.client.clear()
	})
	await f.render()
	const user = { id: 'user-two' }
	f.state.auth = { ...f.state.auth, user, session: { user } }
	await f.render()
	await f.act(() => resolveFirst({ autoDrop: true }))
	assert.equal(f.prefs.autoDrop, false)
	await f.act(() => f.queue.prepare(items('manual')))
	assert.deepEqual(f.sends, [])
})

test('native adapters use Store persistence and the clipboard plugin without browser focus', async (t) => {
	await setup(t)
	const { mockIPC, clearMocks } = await import('@tauri-apps/api/mocks')
	const originalNative = Object.getOwnPropertyDescriptor(globalThis, 'isTauri')
	Object.defineProperty(globalThis, 'isTauri', {
		value: true,
		configurable: true,
	})
	let data, disk
	const clipboard = []
	mockIPC((command, args) => {
		switch (command) {
			case 'plugin:store|load':
				assert.equal(args.path, 'preferences.json')
				assert.equal(args.options.autoSave, false)
				data = structuredClone(args.options.defaults)
				return 1
			case 'plugin:store|get':
				return [data[args.key], Object.hasOwn(data, args.key)]
			case 'plugin:store|set':
				data[args.key] = args.value
				return
			case 'plugin:store|save':
				disk = structuredClone(data)
				return
			case 'plugin:clipboard-manager|write_text':
				clipboard.push(args.text)
				return
			default:
				throw new Error(`Unexpected native command: ${command}`)
		}
	})
	t.after(() => {
		if (originalNative)
			Object.defineProperty(globalThis, 'isTauri', originalNative)
		else delete globalThis.isTauri
	})
	const { preferencesCommands } = await import(
		'../src/desktop/preferences.commands.ts'
	)
	const { copyText } = await import('../src/desktop/app.commands.ts')
	assert.deepEqual(await preferencesCommands.read('one'), { autoDrop: false })
	await preferencesCommands.write('one', { autoDrop: true })
	assert.equal(disk.users.one.autoDrop, true)
	assert.deepEqual(await preferencesCommands.read('two'), { autoDrop: false })
	await copyText('https://storage.example/preview')
	assert.deepEqual(clipboard, ['https://storage.example/preview'])
	clearMocks()
})
