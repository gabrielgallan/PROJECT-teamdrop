import { createHash, randomBytes } from 'node:crypto'
import { Injectable } from '@nestjs/common'

@Injectable()
export class CryptographyService {
	generateToken(): string {
		return randomBytes(32).toString('base64url')
	}

	hashToken(value: string, encoding: 'base64url' | 'hex' = 'base64url'): string {
		return createHash('sha256').update(value).digest(encoding)
	}
}
