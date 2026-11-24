import { ApiProperty } from "@nestjs/swagger";

export class GenerateFileUrlResponseDto {
	@ApiProperty({
		example: 'https://example.com',
	})
	url!: string
}