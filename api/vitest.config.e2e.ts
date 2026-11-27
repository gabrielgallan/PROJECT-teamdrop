import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

if (existsSync('.env.test')) {
	console.log('loading env from .env.test')
	loadEnvFile('.env.test')
}

export default defineConfig({
	test: {
		name: 'E2E',
		include: ['./test/e2e/**/*.spec.ts'],
		fileParallelism: false,
		globalSetup: ['test/e2e/setup.ts'],
		globals: true,
		root: './',
		hookTimeout: 15000,
	},
	plugins: [
		// This is required to build the test files with SWC
		swc.vite({
			// Explicitly set the module type to avoid inheriting this value from a `.swcrc` config file
			module: { type: 'es6' },
		}),
	],
})
