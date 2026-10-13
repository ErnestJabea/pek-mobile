import { test } from 'node:test'
import assert from 'node:assert/strict'

test('copyTextToClipboard returns false when text is empty', async () => {
  const { copyTextToClipboard } = await import('../src/utils/clipboard.js')
  assert.equal(await copyTextToClipboard(''), false)
  assert.equal(await copyTextToClipboard(null), false)
  assert.equal(await copyTextToClipboard(undefined), false)
})

test('copyTextToClipboard uses navigator.clipboard.writeText when available', async () => {
  let copiedValue = ''
  
  Object.defineProperty(globalThis, 'window', {
    value: {
      isSecureContext: true,
      location: { hostname: 'localhost' }
    },
    configurable: true,
    writable: true
  })

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      clipboard: {
        writeText: async (text) => {
          copiedValue = text
          return Promise.resolve()
        }
      }
    },
    configurable: true,
    writable: true
  })

  const { copyTextToClipboard } = await import('../src/utils/clipboard.js')
  const result = await copyTextToClipboard('JBSWY3DPEHPK3PXP')

  assert.equal(result, true)
  assert.equal(copiedValue, 'JBSWY3DPEHPK3PXP')
})

test('copyTextToClipboard falls back to document.execCommand when navigator.clipboard throws or is absent', async () => {
  let execCommandCalled = false
  let appendedElement = null
  let removedElement = null

  Object.defineProperty(globalThis, 'window', {
    value: {
      isSecureContext: false,
      location: { hostname: '192.168.1.100' }
    },
    configurable: true,
    writable: true
  })

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      clipboard: {
        writeText: async () => {
          throw new Error('NotAllowedError')
        }
      }
    },
    configurable: true,
    writable: true
  })

  Object.defineProperty(globalThis, 'document', {
    value: {
      body: {
        appendChild: (el) => { appendedElement = el },
        removeChild: (el) => { removedElement = el }
      },
      createElement: () => ({
        style: {},
        setAttribute: () => {},
        focus: () => {},
        select: () => {},
        setSelectionRange: () => {},
        value: ''
      }),
      execCommand: (cmd) => {
        if (cmd === 'copy') {
          execCommandCalled = true
          return true
        }
        return false
      }
    },
    configurable: true,
    writable: true
  })

  const { copyTextToClipboard } = await import('../src/utils/clipboard.js')
  const result = await copyTextToClipboard('SECRET-KEY-FALLBACK-123')

  assert.equal(result, true)
  assert.equal(execCommandCalled, true)
  assert.ok(appendedElement)
  assert.equal(appendedElement, removedElement)
})
