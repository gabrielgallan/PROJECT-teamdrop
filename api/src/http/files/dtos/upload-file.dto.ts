export interface UploadFileServiceDto {
	userId: string
	teamId: string
	fileName: string
	fileData: Buffer
	fileSize: number
	fileMimeType: string
}
