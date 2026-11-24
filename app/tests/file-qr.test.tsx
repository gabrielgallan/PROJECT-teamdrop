// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileQrScreen } from '../src/screens/file-qr-screen'
import { DropsScreen } from '../src/screens/drops-screen'
import { generateFileUrl, listFiles } from '../src/services/files'
import type { TeamActions } from '../src/hooks/use-team-settings'
import type { TeamFile } from '../src/types/file'

vi.mock('../src/services/files', async (original) => ({
	...(await original<typeof import('../src/services/files')>()), generateFileUrl: vi.fn(), listFiles: vi.fn(),
}))
const file: TeamFile = {
	id: '019ab000-0000-7000-8000-000000000001', teamId: 'team', name: 'Relatório.txt',
	mimeType: 'text/plain', size: '10 B', createdAt: Date.now(), kind: 'document',
	member: { id: 'person', name: 'Pessoa', initials: 'PE', color: '' },
}
const url = 'https://storage.example.test/report.txt?sv=2026&sig=temporary-signature'
beforeEach(() => {
	vi.clearAllMocks()
	vi.mocked(generateFileUrl).mockResolvedValue(url)
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0))
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('file QR screen', () => {
	it('renders the real QR SVG, requests the public file URL and focuses the back button', async () => {
		render(<FileQrScreen file={file} onBack={vi.fn()} />)
		expect(screen.getByRole('status').textContent).toContain('Gerando QR Code')
		const code = await screen.findByRole('img', { name: `QR Code para abrir ${file.name}` })
		expect(code.querySelector('svg')).not.toBeNull()
		expect(code.querySelector('svg')?.getAttribute('width')).toBe('200')
		expect(generateFileUrl).toHaveBeenCalledWith(file.id, expect.any(AbortSignal))
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Voltar aos arquivos' }))
	})

	it('removes the expired QR and generates a fresh URL on demand', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-11-23T12:00:00Z'))
		render(<FileQrScreen file={file} onBack={vi.fn()} />)
		await act(async () => {})
		expect(screen.getByText('Expira em 5:00')).toBeTruthy()
		await act(async () => vi.advanceTimersByTimeAsync(300_000))
		expect(screen.queryByRole('img')).toBeNull()
		expect(screen.getByText('Este QR Code expirou.')).toBeTruthy()
		vi.mocked(generateFileUrl).mockResolvedValueOnce(url + '-new')
		await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Gerar novo QR Code' })))
		expect(generateFileUrl).toHaveBeenCalledTimes(2)
		expect(screen.getByRole('img')).toBeTruthy()
		expect(screen.getByText('Expira em 5:00')).toBeTruthy()
	})

	it('accounts for request latency and rechecks the deadline after the window resumes', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-11-23T12:00:00Z'))
		let resolve!: (value: string) => void
		vi.mocked(generateFileUrl).mockReturnValueOnce(new Promise((done) => { resolve = done }))
		render(<FileQrScreen file={file} onBack={vi.fn()} />)
		await act(async () => vi.advanceTimersByTimeAsync(10_000))
		await act(async () => resolve(url))
		expect(screen.getByText('Expira em 4:50')).toBeTruthy()
		vi.setSystemTime(new Date('2026-11-23T12:06:00Z'))
		act(() => window.dispatchEvent(new Event('focus')))
		expect(screen.queryByRole('img')).toBeNull()
	})

	it('shows a retryable error and aborts an outstanding request when leaving', async () => {
		vi.mocked(generateFileUrl).mockRejectedValueOnce(new TypeError('offline'))
		const onBack = vi.fn()
		const view = render(<FileQrScreen file={file} onBack={onBack} />)
		expect(await screen.findByRole('alert')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
		await screen.findByRole('img')
		fireEvent.keyDown(window, { key: 'Escape' })
		expect(onBack).toHaveBeenCalledOnce()
		const signal = vi.mocked(generateFileUrl).mock.calls.at(-1)![1]!
		view.unmount()
		expect(signal.aborted).toBe(true)
	})
})

it('opens from a separate list action and preserves the list, scroll and focus when returning', async () => {
	const user = { id: 'user', name: 'Pessoa', email: 'person@example.test', avatarUrl: null }
	const teams = { teams: [
		{ id: 'team', name: 'Equipe', slug: 'equipe', role: 'member', members: [] },
		{ id: 'other', name: 'Outro time', slug: 'outro', role: 'member', members: [] },
	],
		busy: false, loading: false, error: '', refresh: vi.fn() } as unknown as TeamActions
	vi.mocked(listFiles).mockResolvedValue({ files: [{ id: file.id, name: file.name, mimeType: file.mimeType,
		size: 10, createdAt: new Date(file.createdAt).toISOString(), author: user }], nextCursor: null })
	render(<DropsScreen user={user} teamSettings={teams} settingsOpen={false} onSettingsChange={vi.fn()}
		onLogout={vi.fn()} authBusy={false} authError="" authNeedsLogin={false} onAuthRetry={vi.fn()} />)
	const trigger = await screen.findByRole('button', { name: `Exibir QR Code de ${file.name}` })
	const list = screen.getByRole('region', { name: 'Arquivos recentes da equipe' })
	list.scrollTop = 140
	fireEvent.click(trigger)
	await screen.findByRole('img', { name: `QR Code para abrir ${file.name}` })
	expect(screen.queryByRole('button', { name: `Baixar ${file.name}` })).toBeNull()
	fireEvent.click(screen.getByRole('button', { name: 'Voltar aos arquivos' }))
	await waitFor(() => expect(document.activeElement).toBe(trigger))
	expect(screen.getByRole('region', { name: 'Arquivos recentes da equipe' })).toBe(list)
	expect(list.scrollTop).toBe(140)
	expect(listFiles).toHaveBeenCalledOnce()
})
