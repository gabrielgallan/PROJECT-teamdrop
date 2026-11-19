import { randomBytes } from 'node:crypto'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { CacheRepository } from '../cache/cache.interface.js'
import { hashToken } from './auth.crypto.js'

export const LOGIN_TTL_SECONDS = 300
type Ticket = { challenge: string; status: 'pending' | 'complete' | 'denied'; userId?: string }

@Injectable()
export class DesktopTicketService {
	constructor(private cache: CacheRepository) {}

	async create(challenge: string) {
		const ticket = randomBytes(32).toString('base64url')
		await this.cache.set(
			this.key(ticket),
			JSON.stringify({ challenge, status: 'pending' }),
			LOGIN_TTL_SECONDS,
		)
		return ticket
	}

	async complete(ticket: string, userId?: string) {
		const value = await this.cache.get(this.key(ticket))
		if (!value) return false
		const record: Ticket = JSON.parse(value)
		await this.cache.set(
			this.key(ticket),
			JSON.stringify({ ...record, status: userId ? 'complete' : 'denied', userId }),
			60,
		)
		return true
	}

	async exchange(ticket: string, verifier: string) {
		const key = this.key(ticket)
		const value = await this.cache.get(key)
		if (!value) throw new UnauthorizedException('Invalid or expired login')
		const record: Ticket = JSON.parse(value)
		if (record.challenge !== hashToken(verifier))
			throw new UnauthorizedException('Invalid login verifier')
		if (record.status === 'pending') return null
		// Only consume after proof validation and completion; GETDEL prevents replay.
		const consumed = await this.cache.getDel(key)
		if (!consumed) throw new UnauthorizedException('Login already exchanged')
		const result: Ticket = JSON.parse(consumed)
		if (result.status !== 'complete' || !result.userId)
			throw new UnauthorizedException('Google login was not completed')
		return result.userId
	}

	private key(ticket: string) {
		return `auth:desktop:${hashToken(ticket)}`
	}
}
