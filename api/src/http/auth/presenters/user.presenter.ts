import { User } from '../../../database/prisma/client/client.js'

export class UserPresenter {
	static toHTTP(user: User) {
		return {
			...user,
			id: undefined,
			createdAt: undefined,
			updatedAt: undefined,
		}
	}
}
