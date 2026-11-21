import { Controller, Get, Header, Param } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { Public } from '../../auth/decorators/public.decorator.js'

@ApiExcludeController()
@Controller('invites')
export class InvitePageController {
	@Public()
	@Get(':token')
	@Header('Content-Type', 'text/html; charset=utf-8')
	@Header('Cache-Control', 'no-store')
	@Header('Referrer-Policy', 'no-referrer')
	@Header('X-Content-Type-Options', 'nosniff')
	@Header(
		'Content-Security-Policy',
		"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
	)
	show(@Param('token') token: string) {
		const url = `teamdrop://invite?token=${encodeURIComponent(token)}`
		return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Convite para o Teamdrop</title>
<style>body{margin:0;background:#18181b;color:#fafafa;font:16px/1.6 system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}main{max-width:440px;padding:32px}h1{font-size:24px}a{display:inline-block;background:#a5b4fc;color:#18181b;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600}a:focus-visible{outline:3px solid white;outline-offset:4px}p{color:#d4d4d8}</style>
</head><body><main><h1>Você recebeu um convite</h1><p>Abra o Teamdrop para entrar na sua conta e confirmar o ingresso no time.</p>
<a href="${url}" rel="noreferrer">Abrir no Teamdrop</a>
<p>Não abriu? No widget, acesse Configurações → Entrar com convite e cole o link desta página.</p>
<p>O Teamdrop precisa estar instalado neste computador.</p></main></body></html>`
	}
}
