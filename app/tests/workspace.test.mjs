import assert from 'node:assert/strict'
import test, { beforeEach, afterEach, after } from 'node:test'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://app.test', pretendToBeVisual: true })
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLDialogElement', 'localStorage']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
}
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (!dom.window.HTMLDialogElement.prototype.showModal) dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
if (!dom.window.HTMLDialogElement.prototype.close) dom.window.HTMLDialogElement.prototype.close = function () { this.open = false }
dom.window.HTMLElement.prototype.hidePopover = function () {}
dom.window.HTMLElement.prototype.showPopover = function () {}

let respond, requests
globalThis.fetch = async (request) => {
  requests.push({ method: request.method, url: request.url, auth: request.headers.get('Authorization') })
  return respond(request)
}
const { authStore } = await import('../src/auth/auth.store.ts')
const { authCommands } = await import('../src/desktop/auth.commands.ts')
authCommands.getAccessToken = async () => authStore.getSnapshot().session.user.id
authCommands.logout = async () => {}
const { initializeAuthCache } = await import('../src/api/session-cache.ts')
const { queryClient } = await import('../src/lib/react-query.ts')
const { queryKeys } = await import('../src/api/query-keys.ts')
const { setPendingInvite } = await import('../src/desktop/invite-links.ts')
const { Router } = await import('../src/app/router/index.tsx')
const { QueryClientProvider } = await import('@tanstack/react-query')
const { MemoryRouter } = await import('react-router')
const { createRoot } = await import('react-dom/client')
const { WorkspaceProvider } = await import('../src/app/providers/workspace.provider.tsx')
const { UploadPanel } = await import('../src/app/components/upload-panel.tsx')
const { useSelectedTeam, useTeamUploadQueue } = await import('../src/hooks/use-workspace.ts')
const user = { id: 'account-a', name: 'Gabriel', email: 'g@test.com', avatarUrl: null }
const team = { id: 't', name: 'Equipe original', slug: 'original', role: 'owner' }
let root, unsubscribe
const text = () => document.body.textContent
const button = (label) => [...document.querySelectorAll('button')].find((element) => element.textContent.trim() === label || element.getAttribute('aria-label') === label)
async function click(element) {
  assert.ok(element, 'Expected an interactive element')
  await act(async () => element.click())
}
async function waitFor(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)) })
  }
  assert.ok(predicate(), text())
}
async function mount(path = '/') {
  await act(async () => root.render(React.createElement(QueryClientProvider, { client: queryClient },
    React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(Router)))))
}
beforeEach(() => {
  requests = []
  queryClient.clear()
  localStorage.clear()
  setPendingInvite(null)
  authStore.update({ session: { user }, status: 'authenticated', busy: null, needsLogin: false, error: '' })
  unsubscribe = initializeAuthCache()
  root = createRoot(document.getElementById('root'))
  respond = async (request) => {
    const path = new URL(request.url).pathname
    if (path === '/api/teams') return Response.json({ teams: [team] })
    if (path.endsWith('/members')) return Response.json({ users: [{ ...user, role: 'owner' }] })
    if (path.endsWith('/files')) return Response.json({ files: [], nextCursor: null })
    throw Error('Unexpected API path: ' + path)
  }
})
afterEach(async () => {
  await act(async () => root.unmount())
  unsubscribe()
  queryClient.clear()
})
after(() => dom.window.close())

test('upload feedback stays indeterminate until confirmation and stops on failure', async () => {
  let queue, finishUpload
  const normal = respond
  respond = async (request) => {
    if (request.method === 'POST' && new URL(request.url).pathname === '/api/teams/t/files') {
      return new Promise((resolve) => { finishUpload = resolve })
    }
    return normal(request)
  }
  function Probe() {
    queue = useTeamUploadQueue()
    return React.createElement(UploadPanel, null)
  }
  await act(async () => root.render(React.createElement(QueryClientProvider, { client: queryClient },
    React.createElement(MemoryRouter, null, React.createElement(WorkspaceProvider, null, React.createElement(Probe))))))
  await waitFor(() => queue?.teamId === 't')
  const file = { id: 'pending', name: 'test.txt', file: new File(['data'], 'test.txt'), kind: 'document' }
  await act(async () => queue.prepare([file]))
  let uploading
  await act(async () => { uploading = queue.share(); await new Promise((resolve) => setTimeout(resolve, 5)) })
  await waitFor(() => Boolean(finishUpload))
  const progress = document.querySelector('[role="progressbar"]')
  assert.ok(progress)
  assert.equal(progress.hasAttribute('aria-valuenow'), false)
  assert.match(text(), /Enviando arquivo/)
  assert.ok(!text().includes('Arquivo enviado'))
  await act(async () => { finishUpload(Response.json({ file: { id: 'saved' } })); await uploading })
  assert.equal(document.querySelector('[role="progressbar"]'), null)
  assert.match(text(), /Arquivo enviado/)
  assert.equal(queue.pending.length, 0)
  assert.equal(queue.sharing, false)

  // The confirmation does not prevent selecting or sending another file.
  await act(async () => queue.prepare([file]))
  assert.ok(!text().includes('Arquivo enviado'))
  finishUpload = undefined
  await act(async () => { uploading = queue.share(); await new Promise((resolve) => setTimeout(resolve, 5)) })
  await waitFor(() => Boolean(finishUpload))
  await act(async () => { finishUpload(Response.json({ message: 'Unavailable' }, { status: 503 })); await uploading })
  assert.equal(document.querySelector('[role="progressbar"]'), null)
  assert.ok(!text().includes('Arquivo enviado'))
  assert.match(text(), /indisponível/)
  assert.equal(queue.pending.length, 1)
})

test('guards wait for restore and resume the requested team route', async () => {
  authStore.update({ session: null, status: 'restoring', busy: 'restore' })
  await mount('/settings/teams/t')
  assert.match(text(), /Restaurando sessão/)
  assert.equal(requests.length, 0)
  await act(async () => authStore.update({ session: { user }, status: 'authenticated', busy: null }))
  await waitFor(() => document.getElementById('team-name'))
  assert.equal(document.getElementById('team-name').value, team.name)
  await waitFor(() => text().includes('Você'))
  assert.ok(requests.some((request) => request.url.endsWith('/api/teams/t/members')))
})

test('settings and team routes consume shared data and restore focus on return', async () => {
  await mount()
  await waitFor(() => text().includes(team.name))
  await click(button('Configurações'))
  await waitFor(() => button('Gerenciar ' + team.name))
  const teamRow = button('Gerenciar ' + team.name)
  assert.equal(teamRow.parentElement.tagName, 'LI')
  assert.equal(teamRow.querySelector('button'), null)
  await click(teamRow)
  await waitFor(() => document.getElementById('team-name'))
  await click(button('Voltar às configurações'))
  await waitFor(() => document.activeElement?.id === 'manage-team-t')
  await click(button('Voltar aos arquivos'))
  await waitFor(() => document.activeElement?.id === 'settings-button')
})

test('members open their team from the full row and can leave without management controls', async () => {
  let left = false
  const memberTeam = { ...team, role: 'member' }
  respond = async (request) => {
    const path = new URL(request.url).pathname
    if (path === '/api/teams') return Response.json({ teams: left ? [] : [memberTeam] })
    if (path === '/api/teams/t/members') return Response.json({ users: [
      { ...user, role: 'member' },
      { ...user, id: 'owner', name: 'Proprietário', role: 'owner' },
      { ...user, id: 'other', name: 'Outro membro', role: 'member' },
    ] })
    if (path === '/api/teams/t/members/me' && request.method === 'DELETE') {
      left = true
      return new Response(null, { status: 204 })
    }
    throw Error('Unexpected API path: ' + path)
  }
  await mount('/settings')
  await waitFor(() => button('Abrir time ' + team.name))
  await click(button('Abrir time ' + team.name))
  await waitFor(() => text().includes('Outro membro'))
  assert.ok(button('Sair do time'))
  assert.equal(document.getElementById('team-name'), null)
  assert.equal(button('Gerar convite'), undefined)
  assert.equal(button('Remover Outro membro'), undefined)
  await click(button('Sair do time'))
  await click([...document.querySelectorAll('dialog button')].find((element) => element.textContent.trim() === 'Sair do time'))
  await waitFor(() => text().includes('Seus times') && text().includes('Você ainda não participa'))
  assert.equal(left, true)
})

test('a desktop invite received before login opens after authentication and uses new accept endpoint', async () => {
  const token = 'a'.repeat(43)
  const normal = respond
  respond = async (request) => {
    const path = new URL(request.url).pathname
    if (path === `/api/invites/${token}`) return Response.json({ team, alreadyMember: false })
    if (path === `/api/invites/${token}/accept`) { assert.equal(request.method, 'POST'); return Response.json({ team }) }
    return normal(request)
  }
  authStore.update({ session: null, status: 'anonymous' })
  setPendingInvite(token)
  await mount()
  await waitFor(() => text().includes('Entrar com Google'))
  assert.equal(requests.length, 0)
  await act(async () => authStore.update({ session: { user }, status: 'authenticated' }))
  await waitFor(() => button('Entrar no time'))
  await click(button('Entrar no time'))
  await waitFor(() => text().includes('Você faz parte do time'))
  assert.ok(requests.some((request) => request.url.endsWith(`/api/invites/${token}/accept`)))
  await click(button('Voltar aos times'))
  await waitFor(() => text().includes('Seus times'))
})

test('logout clears cached account data and the next account loads its own teams', async () => {
  await mount('/settings')
  await waitFor(() => text().includes('Seus times') && text().includes(team.name))
  assert.ok(queryClient.getQueryData(queryKeys.teams(user.id)))
  await click(button('Logout'))
  await waitFor(() => text().includes('Entrar com Google'))
  assert.equal(queryClient.getQueryData(queryKeys.teams(user.id)), undefined)
  const other = { ...user, id: 'account-b', name: 'Outra conta' }
  respond = async (request) => {
    assert.equal(request.headers.get('Authorization'), 'Bearer account-b')
    return Response.json({ teams: [{ ...team, id: 'other', name: 'Outro time' }] })
  }
  await act(async () => authStore.update({ session: { user: other }, status: 'authenticated' }))
  await waitFor(() => text().includes('Outro time'))
  assert.ok(!text().includes(team.name))
  assert.equal(queryClient.getQueryData(queryKeys.teams(user.id)), undefined)
})

test('direct QR navigation works without file metadata and supports expiry and explicit renewal', async () => {
  let urls = 0
  const normal = respond
  respond = async (request) => {
    if (new URL(request.url).pathname === '/api/files/f/url') {
      urls++
      assert.equal(request.headers.get('Authorization'), null)
      return Response.json({ url: `https://storage.test/file?generation=${urls}` })
    }
    return normal(request)
  }
  await mount('/teams/t/files/f/qr')
  await waitFor(() => document.querySelector('[aria-label="QR Code para abrir Arquivo compartilhado"]'))
  const realNow = Date.now
  const future = realNow() + 301_000
  try {
    Date.now = () => future
    await act(async () => window.dispatchEvent(new dom.window.Event('focus')))
    await waitFor(() => text().includes('Este QR Code expirou.'))
    assert.equal(urls, 1)
    await click(button('Gerar novo QR Code'))
    await waitFor(() => urls === 2 && text().includes('Expira em'))
  } finally { Date.now = realNow }
})

test('team changes reset the queue and cannot redirect an active upload to another team', async () => {
  let selected, queue, finishUpload
  const otherTeam = { ...team, id: 'other', name: 'Outro time' }
  respond = async (request) => {
    const path = new URL(request.url).pathname
    if (path === '/api/teams') return Response.json({ teams: [team, otherTeam] })
    if (path === '/api/teams/t/files' && request.method === 'POST') return new Promise((resolve) => { finishUpload = () => resolve(Response.json({ file: { id: 'new-file' } })) })
    throw Error('Unexpected API path: ' + path)
  }
  function Probe() {
    selected = useSelectedTeam()
    queue = useTeamUploadQueue()
    return null
  }
  await act(async () => root.render(React.createElement(QueryClientProvider, { client: queryClient },
    React.createElement(WorkspaceProvider, null, React.createElement(Probe)))))
  await waitFor(() => selected?.team?.id === 't')
  const pending = { id: 'pending', name: 'test.txt', file: new File(['data'], 'test.txt'), kind: 'document' }
  await act(async () => queue.prepare([pending]))
  assert.equal(queue.pending.length, 1)
  await act(async () => selected.selectTeam('other'))
  assert.equal(selected.team.id, 'other')
  assert.equal(queue.pending.length, 0)
  await act(async () => selected.selectTeam('t'))
  await act(async () => queue.prepare([pending]))
  let uploading
  await act(async () => { uploading = queue.share(); await new Promise((resolve) => setTimeout(resolve, 5)) })
  await waitFor(() => Boolean(finishUpload))
  assert.equal(queue.sharing, true)
  await act(async () => selected.selectTeam('other'))
  assert.equal(selected.team.id, 't')
  await act(async () => { finishUpload(); await uploading })
  assert.equal(queue.sharing, false)
  assert.equal(queue.pending.length, 0)
})

test('expired invitations show a recoverable error without retrying HTTP 410', async () => {
  const token = 'b'.repeat(43), normal = respond
  respond = async (request) => new URL(request.url).pathname === `/api/invites/${token}`
    ? Response.json({ message: 'Invitation expired' }, { status: 410 }) : normal(request)
  await mount(`/invites/${token}/accept`)
  await waitFor(() => text().includes('O convite expirou'))
  assert.equal(requests.filter((request) => request.url.endsWith(`/api/invites/${token}`)).length, 1)
  assert.equal(button('Entrar no time'), undefined)
  assert.ok(button('Verificar novamente'))
})
