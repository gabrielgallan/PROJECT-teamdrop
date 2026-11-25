import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Public } from '../../modules/auth/presentation/decorators/public.decorator.js'
import { HealthResponseDto } from './health.dto.js'

interface HealthResponse {
	status: 'healthy' | 'unhealthy'
	memory: NodeJS.MemoryUsage
	uptime: number
	timestamp: number
}

@ApiTags('Health')
@Controller('api/health')
export class HealthController {
	@ApiOperation({
		summary: 'Get server health',
	})
	@ApiResponse({
		status: 200,
		type: HealthResponseDto,
		description: 'Server health retrieved successfully.',
	})
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
