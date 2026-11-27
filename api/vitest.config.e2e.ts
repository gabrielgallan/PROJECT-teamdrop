import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		name: 'E2E',
		include: ['./test/e2e/**/*.spec.ts'],
		fileParallelism: false,
		setupFiles: ['test/e2e/setup'],
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
