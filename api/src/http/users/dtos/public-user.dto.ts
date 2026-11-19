import { ApiProperty } from '@nestjs/swagger'

export class PublicUserDto {
	@ApiProperty({
		example: 'a7cd927d-de92-4af8-b16c-797bb1ec1641',
	})
	id!: string

	@ApiProperty({
		example: 'user@example.com',
	})
	email!: string

	@ApiProperty({
        example: 'John Doe'
    })
    name!: string | null

    @ApiProperty({
        example: 'https://app.com/avatar-1'
    })
    avatarUrl!: string | null
}