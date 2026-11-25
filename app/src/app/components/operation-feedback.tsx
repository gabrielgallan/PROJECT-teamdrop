import { useEffect, useState } from 'react'

export function OperationFeedback({ message }: { message: string }) {
	const [visible, setVisible] = useState(true)
	useEffect(() => {
		const timer = setTimeout(() => setVisible(false), 3500)
		return () => clearTimeout(timer)
	}, [])
	return visible ? (
		<p role="status" className="w-full px-2 py-1 text-xs text-indigo-200">
			{message}
		</p>
	) : null
}
