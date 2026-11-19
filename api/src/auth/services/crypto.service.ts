import { createHash, randomBytes } from 'node:crypto'
import { Injectable } from '@nestjs/common'

@Injectable()
export class CryptoService {
    generateToken = () => randomBytes(32).toString('base64url')
    hashToken = (value: string) => createHash('sha256').update(value).digest('base64url')
}
