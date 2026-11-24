// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTeamFiles } from '../src/hooks/use-team-files'
import * as api from '../src/services/files'
import { uploadContent } from '../src/services/desktop'

vi.mock('../src/services/files', async (original) => ({
	...(await original<typeof import('../src/services/files')>()), listFiles: vi.fn(), uploadFile: vi.fn(),
}))
vi.mock('../src/services/desktop', () => ({ uploadContent: vi.fn() }))
const file = (id: string) => ({ id, name: `${id}.txt`, mimeType: 'text/plain', size: 10, createdAt: '2026-11-23T12:00:00Z', author: { name: null, email: 'person@example.test', avatarUrl: null } })
const pending = (id: string) => ({ id, name: `${id}.txt`, kind: 'document' as const, file: new File(['content'], `${id}.txt`) })
beforeEach(() => {
	vi.clearAllMocks()
	vi.mocked(api.listFiles).mockResolvedValue({ files: [], nextCursor: null })
	vi.mocked(uploadContent).mockImplementation(async (item) => item.file!)
})
afterEach(cleanup)

describe('cursor pagination and team isolation', () => {
	it('loads the first page, deduplicates and retries the failed cursor without losing rows', async () => {
		vi.mocked(api.listFiles).mockResolvedValueOnce({ files: [file('first')], nextCursor: 'cursor' })
		const { result } = renderHook(() => useTeamFiles('team-a'))
		await waitFor(() => expect(result.current.files).toHaveLength(1))
		vi.mocked(api.listFiles).mockRejectedValueOnce(new Error('offline'))
		await act(async () => result.current.loadMore())
		await waitFor(() => expect(result.current.error).toBeTruthy())
		expect(result.current.files).toHaveLength(1)
		vi.mocked(api.listFiles).mockResolvedValueOnce({ files: [file('first'), file('second')], nextCursor: null })
		await act(async () => result.current.retry())
		await waitFor(() => expect(result.current.files).toHaveLength(2))
		expect(api.listFiles).toHaveBeenLastCalledWith('team-a', 'cursor', expect.any(AbortSignal))
		expect(result.current.nextCursor).toBeNull()
	})

	it('ignores a late response from the previous team and cancels it', async () => {
		let resolve!: (page: api.FilesPage) => void
		vi.mocked(api.listFiles).mockReturnValueOnce(new Promise((done) => { resolve = done }))
		const { result, rerender } = renderHook(({ team }) => useTeamFiles(team), { initialProps: { team: 'team-a' } })
		const oldSignal = vi.mocked(api.listFiles).mock.calls[0][2]!
		vi.mocked(api.listFiles).mockResolvedValueOnce({ files: [file('new-team')], nextCursor: null })
		rerender({ team: 'team-b' })
		await waitFor(() => expect(result.current.files[0]?.id).toBe('new-team'))
		await act(async () => resolve({ files: [file('old-team')], nextCursor: 'old-cursor' }))
		expect(oldSignal.aborted).toBe(true)
		expect(result.current.files.map((item) => item.id)).toEqual(['new-team'])
		expect(result.current.files[0].teamId).toBe('team-b')
	})

	it('does not request files without a selected team', () => {
		const { result } = renderHook(() => useTeamFiles(null))
		expect(api.listFiles).not.toHaveBeenCalled()
		expect(result.current.files).toEqual([])
	})
})

describe('upload queue', () => {
	it('uploads sequentially, keeps only failed/unattempted files and refreshes after a partial success', async () => {
		const { result } = renderHook(() => useTeamFiles('team-a'))
		await waitFor(() => expect(api.listFiles).toHaveBeenCalledOnce())
		act(() => result.current.prepare([pending('first'), pending('second'), pending('third')]))
		vi.mocked(api.uploadFile).mockResolvedValueOnce(file('first')).mockRejectedValueOnce(new TypeError('lost response'))
		await act(async () => result.current.share())
		expect(api.uploadFile).toHaveBeenCalledTimes(2)
		expect(result.current.pending.map((item) => item.id)).toEqual(['second', 'third'])
		expect(result.current.uploadError).toContain('Envio não confirmado')
		expect(api.listFiles).toHaveBeenCalledTimes(2)
		expect(result.current.sharing).toBe(false)
	})

	it('keeps prepared files when changing teams and sends them to the new destination', async () => {
		const { result, rerender } = renderHook(({ team }) => useTeamFiles(team), { initialProps: { team: 'team-a' } })
		act(() => result.current.prepare([pending('first')]))
		rerender({ team: 'team-b' })
		vi.mocked(api.uploadFile).mockResolvedValueOnce(file('first'))
		await act(async () => { await Promise.all([result.current.share(), result.current.share()]) })
		expect(api.uploadFile).toHaveBeenCalledOnce()
		expect(api.uploadFile).toHaveBeenCalledWith('team-b', expect.any(File), expect.any(AbortSignal))
		expect(result.current.pending).toEqual([])
	})
})
