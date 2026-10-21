import test from 'node:test'
import assert from 'node:assert/strict'
import { formatErrorMessage } from '../src/utils/formatError.js'

// Simple localStorage mock if not available or incomplete in Node
let store = {}
const mockLocalStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, val) => { store[key] = String(val) },
  removeItem: (key) => { delete store[key] },
  clear: () => { store = {} }
}
try {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true
  })
} catch {
  globalThis.localStorage = mockLocalStorage
}

test('formatErrorMessage translates Too Many Attempts in French when lang is fr', () => {
  localStorage.setItem('lang', 'fr')
  const err = {
    response: {
      status: 429,
      data: { message: 'Too Many Attempts.', retry_after: 45 }
    },
    config: { url: '/reset-password' }
  }
  const result = formatErrorMessage(err)
  assert.match(result, /plusieurs demandes de mot de passe consécutives/i)
  assert.match(result, /quelques instants/i)
  assert.doesNotMatch(result, /Too Many Attempts/i)
})

test('formatErrorMessage translates Too Many Attempts in English when lang is en', () => {
  localStorage.setItem('lang', 'en')
  const err = {
    response: {
      status: 429,
      data: { message: 'Too Many Attempts.', retry_after: 120 }
    },
    config: { url: '/reset-password' }
  }
  const result = formatErrorMessage(err)
  assert.match(result, /several consecutive password requests/i)
  assert.match(result, /about 2 minutes/i)
  assert.doesNotMatch(result, /Too Many Attempts/i)
})

test('formatErrorMessage handles login rate limiting in French and English', () => {
  localStorage.setItem('lang', 'fr')
  const errFr = {
    response: { status: 429, data: { message: 'Too Many Attempts.' } },
    config: { url: '/login' }
  }
  assert.match(formatErrorMessage(errFr), /tentatives de connexion/i)

  localStorage.setItem('lang', 'en')
  const errEn = {
    response: { status: 429, data: { message: 'Too Many Attempts.' } },
    config: { url: '/login' }
  }
  assert.match(formatErrorMessage(errEn), /sign-in attempts/i)
})

test('formatErrorMessage handles registration rate limiting in French and English', () => {
  localStorage.setItem('lang', 'fr')
  const errFr = {
    response: { status: 429, data: { message: 'Too Many Attempts.' } },
    config: { url: '/register' }
  }
  assert.match(formatErrorMessage(errFr), /tentatives d'inscription/i)

  localStorage.setItem('lang', 'en')
  const errEn = {
    response: { status: 429, data: { message: 'Too Many Attempts.' } },
    config: { url: '/register' }
  }
  assert.match(formatErrorMessage(errEn), /registration attempts/i)
})

test('formatErrorMessage handles OTP verification rate limiting in French and English', () => {
  localStorage.setItem('lang', 'fr')
  const errFr = {
    response: { status: 429, data: { message: 'Too Many Attempts.' } },
    config: { url: '/verify-otp' }
  }
  assert.match(formatErrorMessage(errFr), /codes de vérification/i)

  localStorage.setItem('lang', 'en')
  const errEn = {
    response: { status: 429, data: { message: 'Too Many Attempts.' } },
    config: { url: '/verify-otp' }
  }
  assert.match(formatErrorMessage(errEn), /verification code/i)
})

test('formatErrorMessage humanizes network and server errors', () => {
  localStorage.setItem('lang', 'fr')
  const netErrFr = { code: 'ERR_NETWORK' }
  assert.match(formatErrorMessage(netErrFr), /connexion internet/i)

  const serverErrFr = { response: { status: 500 } }
  assert.match(formatErrorMessage(serverErrFr), /momentanément indisponible/i)

  localStorage.setItem('lang', 'en')
  const netErrEn = { code: 'ERR_NETWORK' }
  assert.match(formatErrorMessage(netErrEn), /internet connection/i)

  const serverErrEn = { response: { status: 500 } }
  assert.match(formatErrorMessage(serverErrEn), /temporarily unavailable/i)
})
