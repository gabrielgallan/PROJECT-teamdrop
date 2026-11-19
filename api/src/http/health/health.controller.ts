import { Controller, Get } from '@nestjs/common'
import { Public } from '../../auth/decorators/public.decorator.js'

interface HealthResponse {
	status: 'healthy'
	memory: NodeJS.MemoryUsage
	uptime: number
	timestamp: number
}

@Controller('api/health')
export class HealthController {
	@Get()
	@Public()
	getHealth(): HealthResponse {
		return {
			status: 'healthy',
			memory: process.memoryUsage(),
			uptime: process.uptime(),
			timestamp: Date.now(),
		}
	}
}
