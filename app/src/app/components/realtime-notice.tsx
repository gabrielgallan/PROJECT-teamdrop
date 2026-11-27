import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { queryKeys } from '../../api/query-keys'
import { useAuth } from '../../hooks/use-auth'
import type { RealtimeStatus } from '../../lib/files-realtime'

export function RealtimeNotice() {
	const { user, canQuery } = useAuth()
	const { data: status } = useQuery({
		queryKey: queryKeys.realtime(user.id),
		queryFn: (): RealtimeStatus => 'connecting',
		enabled: false,
	})
	const [visible, setVisible] = useState(false)
	useEffect(() => {
		setVisible(false)
		if (status !== 'reconnecting') return
		const timer = setTimeout(() => setVisible(true), 1500)
		return () => clearTimeout(timer)
	}, [status])
	if (!canQuery || status !== 'reconnecting' || !visible) return null
	return (
		<span role="status" className="text-caption text-white/65">
			Reconectando…
		</span>
	)
}
