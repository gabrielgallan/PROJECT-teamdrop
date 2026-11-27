import { load, type Store } from '@tauri-apps/plugin-store'
import { createPreferencesStorage } from '../lib/user-preferences'

let store: Promise<Store> | undefined
export const preferencesCommands = createPreferencesStorage(() => {
	store ??= load('preferences.json', {
		defaults: { version: 1, users: {} },
		autoSave: false,
	}).catch((error) => {
		store = undefined
		throw error
	})
	return store
})
