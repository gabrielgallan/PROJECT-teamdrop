import { Controller, Get, Param } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { HtmlPage } from '../../../common/http/html/page.decorator.js'
import { htmlPageTemplate } from '../../../common/http/html/page.template.js'
import { Public } from '../../auth/presentation/decorators/public.decorator.js'

@ApiExcludeController()
@Controller('invites')
export class InvitePageController {
	@Public()
	@Get(':token')
	@HtmlPage()
	show(@Param('token') token: string) {
		const url = `teamdrop://invite?token=${encodeURIComponent(token)}`

		return htmlPageTemplate({
			title: 'Convite para o TeamDrop',
			content: `
				<h1>Você recebeu um convite</h1>

				<p>
					Abra o TeamDrop para aceitar o convite
					e começar a colaborar com sua equipe.
				</p>

				<a class="button" href="${url}" rel="noreferrer">
					Abrir no TeamDrop
				</a>

				<p class="muted">
					Não abriu? No widget, acesse Configurações →
					Entrar com convite e cole o link desta página.
				</p>
			`,
		})
	}
}
