import { execSync } from 'node:child_process'

export function setup() {
	const databaseUrl = process.env.DATABASE_URL

	if (!databaseUrl) {
		throw new Error('DATABASE_URL is not defined')
	}

	execSync('pnpm exec prisma migrate deploy', {
		stdio: 'inherit',
		env: process.env,
	})
}
