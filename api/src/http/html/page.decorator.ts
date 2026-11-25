import { applyDecorators, Header } from '@nestjs/common'

export function HtmlPage() {
	return applyDecorators(
		Header('Content-Type', 'text/html; charset=utf-8'),
		Header('Cache-Control', 'no-store'),
		Header('Referrer-Policy', 'no-referrer'),
		Header('X-Content-Type-Options', 'nosniff'),
		Header(
			'Content-Security-Policy',
			"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
		),
	)
}
