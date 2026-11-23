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
          ${content}
        </main>
      </body>
    </html>
  `
}