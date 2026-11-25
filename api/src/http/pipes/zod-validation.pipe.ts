import { BadRequestException, type PipeTransform } from '@nestjs/common'
import type { ZodType } from 'zod'

export class ZodValidationPipe implements PipeTransform {
	constructor(
		private readonly schema: ZodType,
		private readonly errorMessage: string = 'Data validation failed',
	) {}

	transform(value: unknown) {
		const result = this.schema.safeParse(value)

		if (!result.success) {
			throw new BadRequestException({
				statusCode: 400,
				message: this.errorMessage,
				errors: result.error.issues.map((issue) => ({
					field: issue.path.join('.'),
					message: issue.message,
				})),
			})
		}

		return result.data
	}
}
