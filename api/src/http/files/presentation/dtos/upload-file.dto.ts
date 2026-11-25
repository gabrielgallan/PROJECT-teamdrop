import { ApiProperty } from "@nestjs/swagger"
import { PublicFileDto } from "./file.dto.js"

export interface UploadFileServiceDto {
	userId: string
	teamId: string
	fileName: string
	fileData: Buffer
	fileSize: number
	fileMimeType: string
}

export class UploadFileResponseDto {
	@ApiProperty({
		type: PublicFileDto,
	})
	file!: PublicFileDto
}