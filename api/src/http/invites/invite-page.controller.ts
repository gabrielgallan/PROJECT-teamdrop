import { Controller, Get, Header, Param } from '@nestjs/common'
import { ApiExcludeController, ApiExcludeEndpoint } from '@nestjs/swagger'
import { Public } from '../../auth/decorators/public.decorator.js'
import { htmlPageTemplate } from '../html/page.template.js'
import { HtmlPage } from '../html/page.decorator.js'

@ApiExcludeController()
@Controller('invites')
export class InvitePageController {
	
	@Public()
	@Get(':token')
	@HtmlPage()
	show(@Param('token') token: string) {
		const url = `teamdrop://invite?token=${encodeURIComponent(token)}`

		return htmlPageTemplate({
			title: 'Convite para o Teamdrop',
			content: `
				<h1>Você recebeu um convite</h1>

				<p>
					Abra o Teamdrop para aceitar o convite
					e começar a colaborar com sua equipe.
				</p>

				<a class="button" href="${url}" rel="noreferrer">
					Abrir no Teamdrop
				</a>

				<p class="muted">
					Não abriu? No widget, acesse Configurações →
					Entrar com convite e cole o link desta página.
				</p>
			`,
		})
	}
}
