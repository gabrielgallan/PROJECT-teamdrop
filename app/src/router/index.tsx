import { Route, Routes } from 'react-router'
import { LoginScreen } from '../screens/login'
import { PublicRoute } from './public.route'
import { PrivateRoute } from './private.route'
import { WorkspaceLayout } from '../layouts/workspace.layout'

export function Router() {
	return (
		<Routes>
			<Route element={<PublicRoute />}>
				<Route path="/login" element={<LoginScreen />} />
			</Route>

			<Route element={<PrivateRoute />}>
				<Route path="/*" element={<WorkspaceLayout />} />
			</Route>
		</Routes>
	)
}