import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'

export function useScreenBack(path: string, focusId?: string, disabled = false) {
	const navigate = useNavigate()
	const backRef = useRef<HTMLButtonElement>(null)
	const onBack = () => {
		if (!disabled) void navigate(path, { state: { focusId } })
	}
	useEffect(() => {
		backRef.current?.focus()
	}, [])
	useEffect(() => {
		const escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !event.defaultPrevented && !disabled) {
				event.preventDefault()
				onBack()
			}
		}
		window.addEventListener('keydown', escape)
		return () => window.removeEventListener('keydown', escape)
	})
	return { onBack, backRef }
}

export function useRestoreFocus() {
	const location = useLocation()
	useEffect(() => {
		const id = location.state?.focusId
		if (typeof id !== 'string') return
		const frame = requestAnimationFrame(() => {
			const target =
				document.getElementById(id) ?? document.querySelector<HTMLElement>('main button')
			target?.focus({ preventScroll: true })
		})
		return () => cancelAnimationFrame(frame)
	}, [location.key, location.state])
}
