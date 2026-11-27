import { z } from 'zod'

const preferencesSchema = z.object({ autoDrop: z.boolean() })
const usersSchema = z.record(z.string(), preferencesSchema)
export type UserPreferences = z.infer<typeof preferencesSchema>
export const defaultPreferences: UserPreferences = { autoDrop: false }

interface PreferencesStore {
	get<T>(key: string): Promise<T | undefined>
	set(key: string, value: unknown): Promise<void>
	save(): Promise<void>
}

export function createPreferencesStorage(
	load: () => Promise<PreferencesStore>,
) {
	let writes: Promise<unknown> = Promise.resolve()
	async function readUsers(store: PreferencesStore) {
		if ((await store.get('version')) !== 1)
			throw new Error('Unsupported preferences version')
		return usersSchema.parse((await store.get('users')) ?? {})
	}
	return {
		async read(userId: string): Promise<UserPreferences> {
			await writes
			const users = await readUsers(await load())
			return users[userId] ?? { ...defaultPreferences }
		},
		write(userId: string, preferences: UserPreferences): Promise<void> {
			const next = preferencesSchema.parse(preferences)
			const task = writes.then(async () => {
				const store = await load()
				const previous = await readUsers(store)
				await store.set('users', { ...previous, [userId]: next })
				try {
					await store.save()
				} catch (error) {
					// Restore the in-memory store too, so a later save cannot enable
					// a preference whose disk write was reported as failed.
					await store.set('users', previous)
					throw error
				}
			})
			writes = task.catch(() => {})
			return task
		},
	}
}
