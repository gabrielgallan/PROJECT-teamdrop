import { ApiProperty } from '@nestjs/swagger'

export class MemoryUsageDto implements NodeJS.MemoryUsage {
	@ApiProperty({
		example: 104857600,
	})
	rss!: number

	@ApiProperty({
		example: 52428800,
	})
	heapTotal!: number

	@ApiProperty({
		example: 31457280,
	})
	heapUsed!: number

	@ApiProperty({
		example: 2097152,
	})
	external!: number

	@ApiProperty({
		example: 1048576,
	})
	arrayBuffers!: number
}

export class HealthResponseDto {
	@ApiProperty({
		enum: ['healthy', 'unhealthy'],
		example: 'healthy',
	})
	status!: 'healthy' | 'unhealthy'

	@ApiProperty({
		type: MemoryUsageDto,
	})
	memory!: MemoryUsageDto

	@ApiProperty({
		example: 3600.5,
	})
	uptime!: number

	@ApiProperty({
		example: 1795526400000,
	})
	timestamp!: number
}
