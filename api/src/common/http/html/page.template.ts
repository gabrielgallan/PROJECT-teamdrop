import { htmlPageStyles } from './page.style.js'

interface HtmlPageTemplateOptions {
	title: string
	content: string
}

export function htmlPageTemplate({ title, content }: HtmlPageTemplateOptions) {
	return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="color-scheme" content="dark">

        <title>${title}</title>

        <style>${htmlPageStyles}</style>
      </head>

      <body>
        <main>
          <header class="brand" aria-label="TeamDrop">
            <img
              src="https://cdn.jsdelivr.net/npm/lucide-static@0.468.0/icons/package.svg"
              width="38"
              height="38"
              alt=""
              referrerpolicy="no-referrer"
            >
            <span>TeamDrop</span>
          </header>
          ${content}
        </main>
      </body>
    </html>
  `
}
