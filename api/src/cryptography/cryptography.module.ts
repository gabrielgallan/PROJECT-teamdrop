import { Module } from '@nestjs/common'
import { CryptographyService } from './cryptography.service.js'

@Module({
	providers: [CryptographyService],
	exports: [CryptographyService],
})
export class CryptographyModule {}
