import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ isTauri: vi.fn(), getCurrent: vi.fn(), onOpenUrl: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ isTauri: native.isTauri }))
vi.mock('@tauri-apps/plugin-deep-link', () => native)
const first = 'a'.repeat(43)
const second = 'b'.repeat(43)
beforeEach(() => {
	vi.resetModules()
	vi.clearAllMocks()
	native.isTauri.mockReturnValue(true)
	native.getCurrent.mockResolvedValue(null)
	native.onOpenUrl.mockResolvedValue(() => {})
})

describe('invitation links', () => {
	it('extracts tokens from public and native links without following a URL', async () => {
		const { parseInviteLink } = await import('../src/services/invites')
		expect(parseInviteLink(`https://example.com/invites/${first}`)).toBe(first)
		expect(parseInviteLink(`http://localhost:3333/invites/${first}`)).toBe(first)
		expect(parseInviteLink(`teamdrop://invite?token=${first}`)).toBe(first)
	})
	it('rejects other actions, credentials, malformed tokens and extra arguments', async () => {
		const { parseInviteLink } = await import('../src/services/invites')
		for (const link of [
			`teamdrop://other?token=${first}`,
			`https://user:secret@example.com/invites/${first}`,
			`teamdrop://invite?token=${first}&redirect=https://example.com`,
			'javascript:alert(1)',
			`https://example.com/invites/${first}#fragment`,
			'https://example.com/invites/bad',
			`teamdrop://invite?token=${first}&token=${second}`,
		])
			expect(parseInviteLink(link)).toBeNull()
	})
	it('initializes once and delivers a cold-start invitation', async () => {
		native.getCurrent.mockResolvedValue([`teamdrop://invite?token=${first}`])
		const service = await import('../src/services/invites')
		await Promise.all([service.initializeInvites(), service.initializeInvites()])
		expect(native.onOpenUrl).toHaveBeenCalledOnce()
		expect(service.getPendingInvite()).toBe(first)
	})
	it('delivers warm links and ignores duplicate delivery of the pending token', async () => {
		const service = await import('../src/services/invites')
		const listener = vi.fn()
		service.subscribeInvites(listener)
		await service.initializeInvites()
		const receive = native.onOpenUrl.mock.calls[0][0]
		receive([`teamdrop://invite?token=${first}`])
		receive([`teamdrop://invite?token=${first}`])
		expect(listener).toHaveBeenCalledOnce()
		service.setPendingInvite(null)
		expect(service.getPendingInvite()).toBeNull()
	})
	it('does not overwrite a newly received link with an older startup response', async () => {
		let resolve!: (urls: string[]) => void
		native.getCurrent.mockReturnValue(
			new Promise<string[]>((done) => {
				resolve = done
			}),
		)
		const service = await import('../src/services/invites')
		const initialization = service.initializeInvites()
		await vi.waitFor(() => expect(native.getCurrent).toHaveBeenCalledOnce())
		native.onOpenUrl.mock.calls[0][0]([`teamdrop://invite?token=${second}`])
		resolve([`teamdrop://invite?token=${first}`])
		await initialization
		expect(service.getPendingInvite()).toBe(second)
	})
})
