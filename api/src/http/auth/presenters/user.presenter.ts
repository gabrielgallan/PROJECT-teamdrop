import { User } from '../../../database/prisma/client/client.js'

export class UserPresenter {
	static toHTTP(user: Pick<User, 'id' | 'email' | 'name' | 'avatarUrl'>) {
		return {
			id: user.id,
			email: user.email,
			name: user.name,
			avatarUrl: user.avatarUrl,
		}
	}
}
