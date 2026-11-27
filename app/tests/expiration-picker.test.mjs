import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
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
		if (url.endsWith('.css'))
			return { format: 'module', source: '', shortCircuit: true }
		if (/\.tsx?$/.test(url)) {
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
		}
		return next(url, context)
	},
})

test('expiration wheel supports controlled values, keyboard, mouse wheel and disabled state', async (t) => {
	const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' })
	const previous = new Map()
	const globals = {
		window: dom.window,
		document: dom.window.document,
		IS_REACT_ACT_ENVIRONMENT: true,
		// Finish the real library's animations on the next frame.
		requestAnimationFrame: (callback) =>
			setTimeout(() => callback(performance.now() + 10_000), 0),
		cancelAnimationFrame: clearTimeout,
	}
	for (const [key, value] of Object.entries(globals)) {
		previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
		Object.defineProperty(globalThis, key, { value, configurable: true })
	}
	const { act, createElement, createRef } = await import('react')
	const { createRoot } = await import('react-dom/client')
	const { ExpirationPicker } = await import(
		'../src/app/components/expiration-picker.tsx'
	)
	const root = createRoot(document.getElementById('root'))
	t.after(async () => {
		await act(() => root.unmount())
		dom.window.close()
		for (const [key, descriptor] of previous) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor)
			else delete globalThis[key]
		}
	})
	const ref = createRef()
	const changes = []
	let value = 86400
	let disabled = false
	let instance = 0
	const render = () =>
		root.render(
			createElement(ExpirationPicker, {
				key: instance,
				ref,
				value,
				disabled,
				onValueChange: (next) => {
					changes.push(next)
					value = next
					render()
				},
			}),
		)
	const key = async (key) =>
		act(async () => {
			ref.current.dispatchEvent(
				new window.KeyboardEvent('keydown', {
					key,
					bubbles: true,
					cancelable: true,
				}),
			)
			await delay(30)
		})
	await act(render)
	assert.equal(ref.current.getAttribute('role'), 'spinbutton')
	assert.equal(ref.current.getAttribute('aria-valuenow'), '86400')
	assert.equal(ref.current.getAttribute('aria-valuetext'), '24 horas')
	assert.deepEqual(changes, [])
	await key('Home')
	assert.equal(value, 900)
	await key('End')
	assert.equal(value, 259200)
	await key('ArrowUp')
	assert.equal(value, 172800)
	await act(async () => {
		ref.current.dispatchEvent(
			new window.WheelEvent('wheel', { deltaY: -100, cancelable: true }),
		)
		await delay(30)
	})
	assert.equal(value, 86400)
	disabled = true
	await act(render)
	assert.equal(ref.current.getAttribute('aria-disabled'), 'true')
	assert.ok(ref.current.closest('[inert]'))
	await key('Home')
	assert.equal(value, 86400)
	disabled = false
	value = 2700
	instance++
	await act(render)
	assert.equal(ref.current.getAttribute('aria-valuenow'), '2700')
	assert.equal(ref.current.getAttribute('aria-valuetext'), '45 minutos')
	await key('ArrowDown')
	assert.equal(value, 3600)
})
