import { useEffect, useRef, useState } from 'react'
import { createMockFiles, currentUser, teams } from '../mocks/team'
import type { PendingFile, SharedFile } from '../types/team'

export function useTeamFiles() {
	const team = teams[0]
	const teamId = team.id
	const [files, setFiles] = useState(createMockFiles)
	const [pending, setPending] = useState<PendingFile[]>([])
	const [sharing, setSharing] = useState(false)
	const [preparing, setPreparing] = useState(false)
	const [progress, setProgress] = useState(0)
	const timer = useRef<ReturnType<typeof setInterval> | null>(null)
	const urls = useRef<string[]>([])
	useEffect(
		() => () => {
			if (timer.current) clearInterval(timer.current)
			urls.current.forEach(URL.revokeObjectURL)
		},
		[],
	)

	function prepare(batch: PendingFile[]) {
		if (!batch.length || timer.current) return
		setPending(batch)
		setPreparing(true)
		setProgress(0)
		const startedAt = Date.now()
		timer.current = setInterval(() => {
			const percentage = Math.min(100, ((Date.now() - startedAt) / 1400) * 100)
			setProgress(percentage)
			if (percentage < 100) return
			if (timer.current) clearInterval(timer.current)
			timer.current = null
			setPreparing(false)
		}, 100)
	}

	function share(batch: PendingFile[] = pending) {
		if (!batch.length || timer.current) return
		setPending(batch)
		setSharing(true)
		setProgress(0)
		const startedAt = Date.now()
		timer.current = setInterval(() => {
			const percentage = Math.min(100, ((Date.now() - startedAt) / 1400) * 100)
			setProgress(percentage)
			if (percentage < 100) return
			if (timer.current) clearInterval(timer.current)
			timer.current = null
			const now = Date.now()
			const additions = batch.map((item): SharedFile => {
				let url = item.url
				if (item.file) {
					url = URL.createObjectURL(item.file)
					urls.current.push(url)
				}
				const text =
					item.file || item.url
						? undefined
						: `Arquivo de demonstração: ${item.name}\n\nSelecionado no computador. O conteúdo original permanece local.`
				return {
					isNew: true,
					id: item.id,
					teamId,
					name: item.name,
					member: currentUser,
					createdAt: now,
					expiresAt: now + 3 * 86400000,
					kind: item.kind,
					size: item.file ? `${Math.max(1, Math.round(item.file.size / 1024))} KB` : 'Demo',
					url: url ?? `data:text/plain;charset=utf-8,${encodeURIComponent(text ?? '')}`,
					link: `https://teamdrop.example/f/${item.id}`,
					text,
				}
			})
			setFiles((previous) => [...additions, ...previous])
			setPending([])
			setSharing(false)
		}, 100)
	}

	function markAsSeen(id: string) {
		setFiles((previous) =>
			previous.map((file) => (file.id === id ? { ...file, isNew: false } : file)),
		)
	}

	return {
		team,
		files: files.filter((file) => file.teamId === teamId),
		pending,
		setPending,
		sharing,
		preparing,
		prepare,
		progress,
		markAsSeen,
		share,
	}
}
