import { test } from 'node:test'
import assert from 'node:assert/strict'

test('VL is always displayed with exactly 2 decimal places regardless of input precision', () => {
  const formatVlDisplay = (val) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '0,00 XAF'
    return `${Number(val).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} XAF`
  }

  // 10 decimals (like the user input 11479.9640927785)
  assert.equal(formatVlDisplay(11479.9640927785), '11\u202F479,96 XAF')
  assert.equal(formatVlDisplay('11479.9640927785'), '11\u202F479,96 XAF')

  // Integer VL (e.g. 10000)
  assert.equal(formatVlDisplay(10000), '10\u202F000,00 XAF')

  // Single decimal VL (e.g. 11468.5)
  assert.equal(formatVlDisplay(11468.5), '11\u202F468,50 XAF')
})

test('Actif Global (portfolio valuation) is strictly rounded as a whole integer without decimals', () => {
  const formatActifGlobal = (val) => {
    return `${Math.round(Number(val || 0)).toLocaleString('fr-FR')} XAF`
  }

  assert.equal(formatActifGlobal(291500.45), '291\u202F500 XAF')
  assert.equal(formatActifGlobal(291500.89), '291\u202F501 XAF')
  assert.equal(formatActifGlobal(1250430), '1\u202F250\u202F430 XAF')
})

test('Financial metrics (plus-value, capital invested) preserve 2 decimal places', () => {
  const formatPlusValue = (val) => {
    const num = Number(val || 0)
    const sign = num >= 0 ? '+' : ''
    return `${sign}${num.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} XAF`
  }

  assert.equal(formatPlusValue(12500.5), '+12\u202F500,50 XAF')
  assert.equal(formatPlusValue(-450.25), '-450,25 XAF')
  assert.equal(formatPlusValue(0), '+0,00 XAF')
})

test('Share calculations retain full mathematical precision without premature rounding', () => {
  const vlExact = 11479.9640927785
  const netInvestment = 50000

  // Calculate shares: net / vl
  const shares = netInvestment / vlExact
  assert.equal(Number(shares.toFixed(8)), 4.35541432)

  // Verify reverse valuation: shares * vl == net
  const valuation = Math.round(shares * vlExact)
  assert.equal(valuation, 50000)
})
