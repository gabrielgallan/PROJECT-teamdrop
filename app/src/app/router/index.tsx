import { Navigate, Route, Routes } from 'react-router'
import { WorkspaceLayout } from '../layouts/workspace.layout'
import { AcceptInviteScreen } from '../screens/accept-invite'
import { DropsScreen } from '../screens/drops'
import { FileQrCodeScreen } from '../screens/file-qr-code'
import { LoginScreen } from '../screens/login'
import { SettingsScreen } from '../screens/settings'
import { TeamSettingsScreen } from '../screens/team-settings'
import { PrivateRoute } from './private.route'
import { PublicRoute } from './public.route'

export function Router() {
	return (
		<Routes>
			<Route element={<PublicRoute />}>
				<Route path="/login" element={<LoginScreen />} />
			</Route>
			<Route element={<PrivateRoute />}>
				<Route element={<WorkspaceLayout />}>
					<Route index element={<DropsScreen />} />
					<Route path="/settings" element={<SettingsScreen />} />
					<Route path="/settings/teams/:teamId" element={<TeamSettingsScreen />} />
					<Route path="/invites/accept" element={<AcceptInviteScreen />} />
					<Route path="/invites/:token/accept" element={<AcceptInviteScreen />} />
					<Route path="/teams/:teamId/files/:fileId/qr" element={<FileQrCodeScreen />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Route>
			</Route>
		</Routes>
	)
}
