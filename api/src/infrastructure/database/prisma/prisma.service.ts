import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import { EnvService } from '../../env/env.service.js'
import { PrismaClient } from './client/client.js'

@Injectable()
export class PrismaService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	constructor(env: EnvService) {
		super({
			adapter: new PrismaPg({ connectionString: env.get('DATABASE_URL') }),
			log: env.get('NODE_ENV') === 'dev' ? ['query', 'error'] : ['error'],
		})
	}

	async onModuleInit() {
		await this.$connect()
	}

	async onModuleDestroy() {
		await this.$disconnect()
	}
}
