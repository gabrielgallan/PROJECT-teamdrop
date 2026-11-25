import assert from 'node:assert/strict'
import test from 'node:test'
import { createApiClient } from '../src/lib/api-client.ts'
import { ApiError } from '../src/lib/api-error.ts'

const json = (data, status = 200) => Response.json(data, { status })
function client(fetch, overrides = {}) {
  return createApiClient({
    baseUrl: 'http://api.test', getSession: () => session, canRequest: () => true,
    getAccessToken: async () => 'access', onAuthFailure: () => {}, fetch, ...overrides,
  })
}
const session = {}

test('private requests attach a token; public calls do not depend on auth', async () => {
  const seen = []
  const api = client(async (request) => { seen.push(request); return json({ ok: true }) })
  await api.get('api/teams')
  assert.equal(seen[0].headers.get('Authorization'), 'Bearer access')
  const publicApi = client(async (request) => { seen.push(request); return json({}) }, {
    getSession: () => null, canRequest: () => false,
    getAccessToken: () => { throw Error('Must not read credentials') },
  })
  await publicApi.get('api/files/id/url', { context: { public: true }, headers: { Authorization: 'Bearer must-be-removed' } })
  assert.equal(seen[1].headers.get('Authorization'), null)
})

test('expired access token replays JSON once with the rejected token', async () => {
  const tokens = [], requests = []
  const api = client(async (request) => {
    requests.push({ auth: request.headers.get('Authorization'), body: await request.json() })
    return requests.length === 1 ? json({ code: 'ACCESS_TOKEN_EXPIRED' }, 401) : json({ team: { id: 'new' } })
  }, { getAccessToken: async (rejected) => { tokens.push(rejected); return rejected ? 'renewed' : 'old' } })
  const result = await api.post('api/teams', { json: { name: 'Equipe' } }).json()
  assert.deepEqual(tokens, [undefined, 'old'])
  assert.deepEqual(requests.map((r) => r.body), [{ name: 'Equipe' }, { name: 'Equipe' }])
  assert.deepEqual(requests.map((r) => r.auth), ['Bearer old', 'Bearer renewed'])
  assert.equal(result.team.id, 'new')
})

test('multipart body survives auth renewal without duplicating its file field', async () => {
  const received = []
  const api = client(async (request) => {
    const form = await request.formData()
    received.push({ count: [...form.keys()].length, content: await form.get('file').text(), name: form.get('file').name })
    return received.length === 1 ? json({ code: 'ACCESS_TOKEN_EXPIRED' }, 401) : json({ file: { id: 'f' } })
  })
  const body = new FormData()
  body.append('file', new File(['conteudo'], 'ação.txt', { type: 'text/plain' }))
  await api.post('api/teams/t/files', { body }).json()
  assert.deepEqual(received, [1, 2].map(() => ({ count: 1, content: 'conteudo', name: 'ação.txt' })))
})

test('401 without explicit expiry does not renew; repeated expiry stops after one replay', async () => {
  for (const code of ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED']) {
    let count = 0, failures = 0
    const api = client(async () => { count++; return json({ code }, 401) }, { onAuthFailure: () => { failures++ } })
    await assert.rejects(api.get('api/teams'), (error) => error instanceof ApiError && error.status === 401 && error.code === code)
    assert.equal(count, code === 'ACCESS_TOKEN_EXPIRED' ? 2 : 1)
    assert.equal(failures, 1)
  }
})

test('HTTP failures without code are normalized and mutations have no generic retry', async () => {
  let count = 0
  const api = client(async () => { count++; return json({ message: 'Unavailable' }, 503) })
  await assert.rejects(api.post('api/teams', { json: { name: 'Equipe' } }), (error) => error instanceof ApiError && error.status === 503 && error.code === undefined)
  assert.equal(count, 1)
  const empty = client(async () => new Response(null, { status: 204 }))
  assert.equal((await empty.delete('api/teams/t/members/me')).status, 204)
})

test('abort during token acquisition prevents the request and does not change auth', async () => {
  const controller = new AbortController()
  let resolveToken, sent = 0, failures = 0
  const api = client(async () => { sent++; return json({}) }, {
    getAccessToken: () => new Promise((resolve) => { resolveToken = resolve }), onAuthFailure: () => { failures++ },
  })
  const promise = api.get('api/teams', { signal: controller.signal })
  const rejection = assert.rejects(promise, { name: 'AbortError' })
  while (!resolveToken) await new Promise((resolve) => setTimeout(resolve, 0))
  controller.abort()
  resolveToken('late')
  await rejection
  assert.equal(sent, 0)
  assert.equal(failures, 0)
})

test('late responses from a previous session are discarded', async () => {
  let active = session, resolveResponse
  const api = client(() => new Promise((resolve) => { resolveResponse = resolve }), { getSession: () => active })
  const promise = api.get('api/teams')
  const rejection = assert.rejects(promise, { name: 'AbortError' })
  while (!resolveResponse) await new Promise((resolve) => setTimeout(resolve, 0))
  active = {}
  resolveResponse(json({ teams: [{ id: 'old-account' }] }))
  await rejection
})

test('refresh failure is forwarded once without replaying the mutation', async () => {
  let count = 0
  const failure = { code: 'REFRESH_UNCERTAIN', message: 'Entre novamente' }, seen = []
  const api = client(async () => { count++; return json({ code: 'ACCESS_TOKEN_EXPIRED' }, 401) }, {
    getAccessToken: async (rejected) => { if (rejected) throw failure; return 'old' }, onAuthFailure: (error) => seen.push(error),
  })
  await assert.rejects(api.post('api/teams', { json: { name: 'Equipe' } }), (error) => error === failure)
  assert.deepEqual(seen, [failure])
  assert.equal(count, 1)
})

test('timeout is bounded and does not retry an upload', async () => {
  let count = 0
  const api = client(async () => { count++; return new Promise(() => {}) })
  await assert.rejects(api.post('api/teams/t/files', { timeout: 10 }), { name: 'TimeoutError' })
  assert.equal(count, 1)
})
