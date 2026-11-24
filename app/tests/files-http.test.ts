import { beforeAll, describe, expect, it, vi } from 'vitest'

const target = process.env.FILES_SIMULATION_URL

describe.skipIf(!target)('files client against Postman HTTP simulation', () => {
	let files: typeof import('../src/services/files')
	beforeAll(async () => {
		vi.stubEnv('VITE_API_URL', target!)
		files = await import('../src/services/files')
		const { configureAuthAccess } = await import('../src/services/api')
		configureAuthAccess({ getToken: async () => 'fixture-jwt', onFailure: vi.fn() })
		await fetch(`${target}/__test/reset`, { method: 'POST' })
	})

	it('sends authenticated cursor requests and returns the final page', async () => {
		const first = await files.listFiles('team-a')
		expect(first.files).toHaveLength(10)
		expect(first.nextCursor).toBe(first.files.at(-1)?.id)
		const last = await files.listFiles('team-a', first.nextCursor!)
		expect(last.files).toHaveLength(3)
		expect(last.nextCursor).toBeNull()
		expect(new Set([...first.files, ...last.files].map((file) => file.id)).size).toBe(13)
		expect((await files.listFiles('team-b')).files).toEqual([])
	})

	it('sends multipart bytes and filename, then lists the uploaded file in the right team', async () => {
		const uploaded = await files.uploadFile('team-b', new File(['fixture upload'], 'anotações.txt', { type: 'text/plain' }))
		expect(uploaded.name).toBe('anotações.txt')
		expect(uploaded.mimeType).toBe('text/plain')
		expect(uploaded).not.toHaveProperty('author')
		const page = await files.listFiles('team-b')
		expect(page.files[0].id).toBe(uploaded.id)
		expect(files.fileView(page.files[0], 'team-b')).toMatchObject({ teamId: 'team-b', name: 'anotações.txt', size: '14 B' })
	})

	it('generates a new public URL each time and follows the public download redirect', async () => {
		const [file] = (await files.listFiles('team-a')).files
		const first = await files.generateFileUrl(file.id)
		expect(first).toContain('https://storage.example.test/')
		await new Promise((resolve) => setTimeout(resolve, 5))
		expect(await files.generateFileUrl(file.id)).not.toBe(first)
		const response = await fetch(`${target}/api/files/${file.id}/download`)
		expect(response.redirected).toBe(true)
		expect(response.headers.get('content-disposition')).toContain('attachment')
		expect(await response.text()).toBe('fixture')
		await expect(files.generateFileUrl('missing')).rejects.toMatchObject({ status: 404 })
	})
})
