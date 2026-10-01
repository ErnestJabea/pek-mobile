import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
test('service worker leaves APIs, payments and foreign origins to the network', () => {
  const handlers = {}
  vm.runInNewContext(source, {
    URL,
    self: { location: { origin: 'https://pek.example' }, addEventListener: (name, handler) => { handlers[name] = handler } },
  })
  for (const url of [
    'https://pek.example/api', 'https://pek.example/api/v1/user',
    'https://pek.example/admin', 'https://pek.example/payment/return',
    'https://pek.example.evil.test/private',
  ]) {
    let intercepted = false
    handlers.fetch({ request: { method: 'GET', url }, respondWith: () => { intercepted = true } })
    assert.equal(intercepted, false, url)
  }
})
