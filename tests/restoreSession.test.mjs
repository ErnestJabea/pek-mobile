import { test } from 'node:test'
import assert from 'node:assert/strict'
import { restoreSession } from '../src/services/restoreSession.js'

for (const status of [undefined, 500, 503, 401, 419]) {
  test(`session restoration handles ${status ?? 'offline'} without a logout request`, async () => {
    let cleared = false
    const store = { token: 'cookie_session', clearAuth() { cleared = true } }
    const api = { async get() { throw { response: status ? { status } : undefined } } }
    const result = await restoreSession(api, store)
    const expired = [401, 419].includes(status)
    assert.equal(cleared, expired)
    assert.equal(result, expired ? 'expired' : 'unavailable')
  })
}
test('successful session restoration loads the authenticated user', async () => {
  let user
  const store = { token: 'cookie_session', setUser(value) { user = value } }
  assert.equal(await restoreSession({ get: async () => ({ data: { id: 7 } }) }, store), 'authenticated')
  assert.deepEqual(user, { id: 7 })
})
