import { useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { parseInviteLink } from '../../desktop/invite-links'
import { useAuth } from '../../hooks/use-auth'
import { Dialog } from './dialog'

export function InviteLinkDialog({ onClose }: { onClose: () => void }) {
	const [link, setLink] = useState('')
	const [error, setError] = useState('')
	const { canQuery } = useAuth()
	const navigate = useNavigate()
	const inputId = useId()
	const errorId = useId()
	const input = useRef<HTMLInputElement>(null)
	return (
		<Dialog
			open
			title="Entrar com convite"
			onClose={onClose}
			initialFocusRef={input}
		>
			<form
				onSubmit={(event) => {
					event.preventDefault()
					if (!canQuery) return
					const token = parseInviteLink(link)
					if (token)
						void navigate(`/invites/${encodeURIComponent(token)}/accept`)
					else {
						setError('Cole um link de convite válido do TeamDrop.')
						input.current?.focus()
					}
				}}
			>
				<label htmlFor={inputId} className="mb-2 block text-xs text-white/75">
					Link de convite
				</label>
				<input
					ref={input}
					id={inputId}
					required
					value={link}
					disabled={!canQuery}
					onChange={(event) => {
						setLink(event.target.value)
						setError('')
					}}
					autoComplete="off"
					spellCheck={false}
					aria-invalid={Boolean(error)}
					aria-describedby={error ? errorId : undefined}
					className="w-full min-w-0 rounded-md bg-white/5 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-indigo-300"
				/>
				{error && (
					<p id={errorId} role="alert" className="mt-2 text-xs text-red-300">
						{error}
					</p>
				)}
				<div className="mt-4 flex flex-wrap justify-end gap-2 text-xs">
					<button
						type="button"
						onClick={onClose}
						className="min-h-8 px-3 text-white/75 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-indigo-300"
					>
						Cancelar
					</button>
					<button
						type="submit"
						disabled={!canQuery || !link.trim()}
						className="min-h-8 bg-indigo-400 px-3 text-zinc-950! enabled:hover:bg-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-300"
					>
						Continuar
					</button>
				</div>
			</form>
		</Dialog>
	)
}
