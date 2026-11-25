import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Run the app's TypeScript/TSX with Node's test runner, without another build tool.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context) } catch (error) {
      if (specifier.startsWith('.') && context.parentURL) {
        for (const extension of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
          const url = new URL(specifier + extension, context.parentURL)
          if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true }
        }
      }
      throw error
    }
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('.ts') && !url.endsWith('.tsx')) return nextLoad(url, context)
    let source = readFileSync(fileURLToPath(url), 'utf8')
    if (url.endsWith('/src/env.ts')) source = source.replace('import.meta.env', "({ VITE_API_URL: 'http://api.test' })")
    return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(source, {
        fileName: fileURLToPath(url),
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      }).outputText,
    }
  },
})
