import assert from 'node:assert/strict'
import test, { after } from 'node:test'

let respond = async () => Response.json({})
globalThis.fetch = (...args) => respond(...args)
const { authCommands } = await import('../src/desktop/auth.commands.ts')
authCommands.getAccessToken = async () => 'access'
const { authStore } = await import('../src/auth/auth.store.ts')
const session = { user: { id: 'account-a', name: 'A', email: 'a@test.com', avatarUrl: null } }
authStore.update({ session, status: 'authenticated', busy: null, needsLogin: false })
const { queryClient, retryQuery } = await import('../src/lib/react-query.ts')
const { queryKeys } = await import('../src/api/query-keys.ts')
const { ApiError } = await import('../src/lib/api-error.ts')
const { createTeamInvite } = await import('../src/api/invites/create-team-invite.ts')
const { revokeTeamInvites } = await import('../src/api/invites/revoke-team-invites.ts')
const { getInviteDetails } = await import('../src/api/invites/get-invite-details.ts')
const { acceptTeamInvite } = await import('../src/api/invites/accept-team-invite.ts')
const { getUserTeams } = await import('../src/api/teams/get-user-teams.ts')
const { createTeam } = await import('../src/api/teams/create-team.ts')
const { updateTeam } = await import('../src/api/teams/update-team.ts')
const { getTeamMembers } = await import('../src/api/teams/get-team-members.ts')
const { leaveTeam } = await import('../src/api/teams/leave-team.ts')
const { removeTeamMember } = await import('../src/api/teams/remove-team-member.ts')
const { getFileUrl } = await import('../src/api/files/get-file-url.ts')
const { uploadTeamFile } = await import('../src/api/files/upload-team-file.ts')
const { startDesktopLogin } = await import('../src/api/auth/start-desktop-login.ts')
const { teamFilesQuery, fileUrlQuery } = await import('../src/api/files/queries.ts')
const { initializeAuthCache } = await import('../src/api/session-cache.ts')
const { setPendingInvite, getPendingInvite, parseInviteLink } = await import('../src/desktop/invite-links.ts')
const { uploadBatch } = await import('../src/api/files/upload-batch.ts')

after(() => queryClient.clear())

test('API functions match controller methods, paths and bodies', async () => {
  const cases = [
    [() => getUserTeams(), 'GET', '/api/teams', undefined, { teams: [] }],
    [() => createTeam({ name: 'Equipe' }), 'POST', '/api/teams', { name: 'Equipe' }, { team: {} }],
    [() => updateTeam({ teamId: 'a/b', newName: 'Novo' }), 'PATCH', '/api/teams/a%2Fb', { newName: 'Novo' }, { team: {} }],
    [() => getTeamMembers({ teamId: 'a/b' }), 'GET', '/api/teams/a%2Fb/members', undefined, { users: [] }],
    [() => leaveTeam({ teamId: 't' }), 'DELETE', '/api/teams/t/members/me', undefined, undefined],
    [() => removeTeamMember({ teamId: 't', memberId: 'u/v' }), 'DELETE', '/api/teams/t/members/u%2Fv', undefined, undefined],
    [() => createTeamInvite({ teamId: 't' }), 'POST', '/api/invites', { teamId: 't' }, { url: 'link' }],
    [() => createTeamInvite({ teamId: 't', maxUses: 4, expiresIn: 600 }), 'POST', '/api/invites', { teamId: 't', maxUses: 4, expiresIn: 600 }, { url: 'link' }],
    [() => revokeTeamInvites({ teamId: 't' }), 'DELETE', '/api/invites', { teamId: 't' }, undefined],
    [() => getInviteDetails({ token: 'a/b' }), 'GET', '/api/invites/a%2Fb', undefined, { team: {}, alreadyMember: false }],
    [() => acceptTeamInvite({ token: 'a/b' }), 'POST', '/api/invites/a%2Fb/accept', undefined, { team: {} }],
  ]
  for (const [run, method, path, body, response] of cases) {
    respond = async (request) => {
      assert.equal(request.method, method)
      assert.equal(new URL(request.url).pathname, path)
      assert.equal(request.headers.get('Authorization'), 'Bearer access')
      assert.deepEqual(request.body ? await request.json() : undefined, body)
      return response === undefined ? new Response(null, { status: 204 }) : Response.json(response)
    }
    assert.deepEqual(await run(), response)
  }
})

test('login start and file URLs are public; uploads send the multipart file field', async () => {
  respond = async (request) => {
    assert.equal(request.headers.get('Authorization'), null)
    if (request.method === 'POST') {
      assert.equal(new URL(request.url).pathname, '/api/auth/desktop/start')
      assert.deepEqual(await request.json(), { codeChallenge: 'pkce' })
      return Response.json({ ticket: 'ticket' })
    }
    assert.equal(new URL(request.url).pathname, '/api/files/f/url')
    return Response.json({ url: 'signed' })
  }
  await startDesktopLogin({ codeChallenge: 'pkce' })
  await getFileUrl({ fileId: 'f' })
  respond = async (request) => {
    assert.equal(request.method, 'POST')
    assert.equal(new URL(request.url).pathname, '/api/teams/t/files')
    assert.match(request.headers.get('Content-Type'), /^multipart\/form-data; boundary=/)
    const form = await request.formData()
    assert.deepEqual([...form.keys()], ['file'])
    assert.equal(await form.get('file').text(), 'data')
    return Response.json({ file: { id: 'f' } })
  }
  assert.deepEqual(await uploadTeamFile({ teamId: 't', file: new File(['data'], 'test.txt') }), { file: { id: 'f' } })
})

test('infinite queries send server cursors and isolate teams/accounts', async () => {
  queryClient.clear()
  const cursors = []
  respond = async (request) => {
    const url = new URL(request.url)
    assert.equal(url.searchParams.get('limit'), '10')
    const cursor = url.searchParams.get('cursor')
    cursors.push(cursor)
    return Response.json({ files: [{ id: cursor ? 'second' : 'first' }], nextCursor: cursor ? null : 'next' })
  }
  const options = teamFilesQuery('account-a', 't')
  await queryClient.fetchInfiniteQuery(options)
  const { InfiniteQueryObserver } = await import('@tanstack/react-query')
  const observer = new InfiniteQueryObserver(queryClient, options)
  await observer.fetchNextPage()
  assert.deepEqual(cursors, [null, 'next'])
  assert.deepEqual(queryClient.getQueryData(options.queryKey).pages.map((page) => page.files[0].id), ['first', 'second'])
  assert.equal(queryClient.getQueryData(teamFilesQuery('account-b', 't').queryKey), undefined)
  assert.equal(queryClient.getQueryData(teamFilesQuery('account-a', 'another').queryKey), undefined)
  assert.equal(observer.getCurrentResult().hasNextPage, false)
  observer.destroy()
})

test('QR validity starts before network latency and does not auto-refresh on focus', async () => {
  respond = async () => { await new Promise((resolve) => setTimeout(resolve, 15)); return Response.json({ url: 'signed' }) }
  const before = Date.now()
  const options = fileUrlQuery('account-a', 't', 'f')
  const data = await queryClient.fetchQuery(options)
  assert.ok(data.expiresAt >= before + 300_000)
  assert.ok(data.expiresAt < Date.now() + 300_000)
  assert.equal(options.refetchOnWindowFocus, false)
  assert.equal(options.refetchOnReconnect, false)
})

test('logout cancels in-flight queries and clears account data and pending invites', async () => {
  queryClient.clear()
  authStore.update({ session, status: 'authenticated', busy: null, needsLogin: false })
  const unsubscribe = initializeAuthCache()
  queryClient.setQueryData(queryKeys.teams('account-a'), { teams: [{ id: 'old' }] })
  setPendingInvite('a'.repeat(43))
  let aborted = false
  const pending = queryClient.fetchQuery({ queryKey: [...queryKeys.account('account-a'), 'slow'], queryFn: ({ signal }) =>
    new Promise((_resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(signal.reason) })) })
  const rejection = assert.rejects(pending)
  authStore.update({ busy: 'logout' })
  await rejection
  assert.equal(aborted, true)
  assert.equal(queryClient.getQueryCache().getAll().length, 0)
  assert.equal(getPendingInvite(), null)
  unsubscribe()
  authStore.update({ session, status: 'authenticated', busy: null })
})

test('partial uploads keep failed and unsent files in the queue', async () => {
  const queue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }], sent = [], confirmed = [], progress = []
  await assert.rejects(uploadBatch(queue, new AbortController().signal, async (file) => {
    sent.push(file.id)
    if (file.id === 'b') throw Error('lost response')
  }, (file) => confirmed.push(file.id), (current, total) => progress.push([current, total])))
  assert.deepEqual(sent, ['a', 'b'])
  assert.deepEqual(confirmed, ['a'])
  assert.deepEqual(queue.filter((file) => !confirmed.includes(file.id)).map((file) => file.id), ['b', 'c'])
  assert.deepEqual(progress, [[1, 3], [2, 3]])
})

test('upload cancellation stops the remaining batch', async () => {
  const controller = new AbortController(), sent = [], confirmed = []
  await assert.rejects(uploadBatch([{ id: 'a' }, { id: 'b' }], controller.signal, async (file) => {
    sent.push(file.id)
    controller.abort()
  }, (file) => confirmed.push(file.id), () => {}), { name: 'AbortError' })
  assert.deepEqual(sent, ['a'])
  assert.deepEqual(confirmed, [])
})

test('retries exclude cancellation, HTTP 4xx and structured auth failures', () => {
  assert.equal(retryQuery(0, new DOMException('cancelled', 'AbortError')), false)
  assert.equal(retryQuery(0, new ApiError(401)), false)
  assert.equal(retryQuery(0, new ApiError(410)), false)
  assert.equal(retryQuery(0, { code: 'REFRESH_UNCERTAIN' }), false)
  assert.equal(retryQuery(1, new ApiError(503)), true)
  assert.equal(retryQuery(2, new ApiError(503)), false)
})

test('manual and desktop invitation links validate their token', () => {
  const token = 'a'.repeat(43)
  assert.equal(parseInviteLink(`teamdrop://invite?token=${token}`), token)
  assert.equal(parseInviteLink(`https://example.com/invites/${token}`), token)
  assert.equal(parseInviteLink(`teamdrop://invite?token=${token}&extra=1`), null)
  assert.equal(parseInviteLink('invalid'), null)
})
