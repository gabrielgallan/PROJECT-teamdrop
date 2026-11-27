import { useUserPreferences } from '../../hooks/use-user-preferences'
import { Checkbox } from './checkbox'

export function UserPreferences() {
	const preferences = useUserPreferences()
	return (
		<section
			aria-labelledby="preferences-title"
			className="px-2 pb-4"
			aria-busy={preferences.loading || preferences.saving}
		>
			<h2
				id="preferences-title"
				className="mx-2 mb-2 mt-4 text-xs font-medium text-white/75"
			>
				Preferências
			</h2>
			<Checkbox
				label="Auto upload"
				checked={preferences.autoDrop}
				disabled={!preferences.ready || preferences.saving}
				onChange={(event) => preferences.setAutoDrop(event.target.checked)}
			/>
			{!preferences.supported && (
				<p className="mx-2 mt-2 text-xs text-white/65">
					Disponível no app desktop.
				</p>
			)}
			{preferences.error && (
				<div role="alert" className="mx-2 mt-2 text-xs text-red-300">
					{preferences.error}{' '}
					{!preferences.ready && (
						<button
							type="button"
							onClick={preferences.retry}
							className="underline"
						>
							Tentar novamente
						</button>
					)}
				</div>
			)}
		</section>
	)
}
