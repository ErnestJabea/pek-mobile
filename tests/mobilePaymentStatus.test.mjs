import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { mobileRetryMode, verifyMobileRetry, isS3pPayment } from '../src/services/mobilePaymentStatus.js'

const failed = (code = '703107') => ({ status: 'failed', can_retry: true, subscription: { id: 12, mobile_provider: 'orange_money' }, payment: { provider: 's3p', status: 'errored', error_code: code } })
for (const state of ['pending', 'verification_required', 'submitted', 'reversed', 'success']) {
  test(`no new payment for ${state} even if stale API allows retry`, () => {
    const data = failed()
    data.payment.status = state
    assert.equal(mobileRetryMode(data), null)
  })
}
test('unknown or absent fields never authorize retry', () => {
  for (const data of [{}, { status: 'pending' }, failed('999999'), failed(null), { ...failed(), can_retry: undefined }, { ...failed(), can_retry: 'true' }]) assert.equal(mobileRetryMode(data), null)
  assert.equal(mobileRetryMode(failed()), 'new')
  assert.equal(mobileRetryMode({ ...failed(), payment: { status: 'quote_failed' } }), 'resume')
})

function screen(name, api, exposed) {
  const source = readFileSync(new URL(`../src/views/${name}.vue`, import.meta.url), 'utf8').split('<script setup>')[1].split('</script>')[0]
    .replace(/^import .*$/gm, '').replaceAll('import.meta.env', '{}')
  const timers = []; const redirects = []; const visits = []
  const context = {
    ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }),
    watch() {}, onMounted() {}, onUnmounted() {}, onBeforeUnmount() {},
    useRoute: () => ({ query: { subscription_id: '12' }, params: {}, fullPath: '/payment-return' }),
    useRouter: () => ({ push: async path => visits.push(path), replace: async path => visits.push(path) }),
    useAuthStore: () => ({ isAuthenticated: true, user: { onboarding_status: 'validated' } }),
    api, mobileRetryMode, verifyMobileRetry, isS3pPayment, URL, console,
    navigator: { onLine: true }, Event: class {},
    setInterval: fn => { timers.push(fn); return timers.length }, clearInterval() {},
    setTimeout: fn => { timers.push(fn); return timers.length }, clearTimeout() {},
    window: { location: { assign: url => redirects.push(url) }, dispatchEvent() {}, setTimeout: fn => { timers.push(fn); return timers.length }, clearTimeout() {}, setInterval() {}, clearInterval() {}, crypto: { randomUUID: () => 'new-request' } },
  }
  return { state: vm.runInNewContext(`(() => { ${source}; return { ${exposed.join(',')} } })()`, context), timers, redirects, visits }
}

test('local timeout followed by retry never posts a second payment', async () => {
  let posts = 0; const requests = []
  const api = { get: async url => { requests.push(url); return { data: { status: 'pending', subscription: { id: 12, mobile_provider: 'orange_money' } } } }, post: async () => { posts++; throw Error('Unexpected debit') } }
  const { state, timers } = screen('Subscription', api, ['startMobilePaymentPolling', 'retryMobilePayment', 'recordedSubscription', 'mobileCanRetry', 'mobilePaymentStatus', 'handleSubscribe', 'closeMobilePendingModal'])
  state.recordedSubscription.value = { id: 12, mobile_provider: 'orange_money' }
  state.startMobilePaymentPolling(12)
  for (let i = 0; i < 181; i++) timers[0]()
  assert.equal(state.mobilePaymentStatus.value, 'timeout')
  assert.equal(state.mobileCanRetry.value, false)
  await state.retryMobilePayment()
  state.closeMobilePendingModal()
  await state.handleSubscribe()
  assert.equal(posts, 0)
  assert.deepEqual(requests, ['/subscriptions/12/payment-status'])
})

test('quote failure resumes the existing subscription once despite double click', async () => {
  const posts = []
  const data = { ...failed(), payment: { provider: 's3p', status: 'quote_failed' } }
  const api = { get: async () => ({ data }), post: async url => { posts.push(url); return { data } } }
  const { state } = screen('Subscription', api, ['retryMobilePayment', 'recordedSubscription'])
  state.recordedSubscription.value = data.subscription
  await Promise.all([state.retryMobilePayment(), state.retryMobilePayment()])
  assert.deepEqual(posts, ['/subscriptions/12/payment-session'])
})

test('verified terminal failure allows one new subscription', async () => {
  const posts = []
  const api = { get: async () => ({ data: failed() }), post: async (url, body, config) => { posts.push({ url, config }); return { data: { subscription: { id: 13, mobile_provider: 'orange_money' } } } } }
  const { state } = screen('Subscription', api, ['retryMobilePayment', 'recordedSubscription', 'fund', 'inputMode', 'inputAmount'])
  state.recordedSubscription.value = failed().subscription
  state.fund.value = { id: 1, vl: 10000 }; state.inputMode.value = 'amount'; state.inputAmount.value = 75000
  await state.retryMobilePayment()
  assert.equal(posts.length, 1)
  assert.equal(posts[0].url, '/subscriptions')
  assert.equal(posts[0].config.headers['Idempotency-Key'], 'new-request')
})

test('verification outage prevents any new subscription', async () => {
  let posts = 0
  const { state } = screen('Subscription', { get: async () => { throw Error('offline') }, post: async () => { posts++ } }, ['retryMobilePayment', 'recordedSubscription', 'mobileCanRetry'])
  state.recordedSubscription.value = failed().subscription
  await state.retryMobilePayment()
  assert.equal(posts, 0); assert.equal(state.mobileCanRetry.value, false)
})

test('S3P return resumes without checkout URL or browser redirect', async () => {
  const data = { ...failed(), payment: { provider: 's3p', status: 'quote_failed' } }
  let posts = 0
  const { state, redirects } = screen('PaymentReturn', { get: async () => ({ data }), post: async () => { posts++; return { data } } }, ['checkStatus', 'resumePayment', 'state'])
  await state.checkStatus(); await state.resumePayment()
  assert.equal(posts, 1); assert.deepEqual(redirects, [])
  assert.equal(state.state.value, 'failed')
})

test('card checkout redirect remains unchanged', async () => {
  const { state, redirects } = screen('PaymentReturn', { post: async () => ({ data: { payment: { checkout_url: 'https://checkout.stripe.com/test' } } }) }, ['resumePayment'])
  await state.resumePayment()
  assert.deepEqual(redirects, ['https://checkout.stripe.com/test'])
})

test('return page does not offer retry when provider and authorization are missing', async () => {
  const { state } = screen('PaymentReturn', { get: async () => ({ data: { status: 'pending' } }) }, ['checkStatus', 'canRetry'])
  await state.checkStatus()
  assert.equal(state.canRetry.value, false)
})

test('identified legacy card payment still offers its existing resume action', async () => {
  const { state } = screen('PaymentReturn', { get: async () => ({ data: { status: 'pending', subscription: { id: 12, moyen_paiement: 'card' } } }) }, ['checkStatus', 'canRetry'])
  await state.checkStatus()
  assert.equal(state.canRetry.value, true)
})
