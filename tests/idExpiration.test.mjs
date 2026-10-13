import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getMinExpirationDate,
  formatIsoDate,
  getDaysInMonth,
  getValidExpirationYears,
  getValidExpirationMonths,
  getValidExpirationDays,
  isExpirationDateValid,
  getExpirationErrorMessage,
} from '../src/utils/idExpiration.js'

test('getMinExpirationDate calculates date at least 1 month ahead', () => {
  const base = new Date('2026-10-13T10:00:00')
  const minDate = getMinExpirationDate(base)
  
  assert.equal(minDate.getFullYear(), 2026)
  assert.equal(minDate.getMonth(), 10) // 10 is November (0-indexed)
  assert.equal(minDate.getDate(), 13)
})

test('getMinExpirationDate handles month overflow safely (e.g. Jan 31 -> Feb 28)', () => {
  const base = new Date('2026-01-31T10:00:00')
  const minDate = getMinExpirationDate(base)
  
  assert.equal(minDate.getFullYear(), 2026)
  assert.equal(minDate.getMonth(), 1) // February
  assert.equal(minDate.getDate(), 28) // 2026 is not a leap year
})

test('formatIsoDate formats YYYY-MM-DD correctly with leading zeroes', () => {
  assert.equal(formatIsoDate('2026', '5', '9'), '2026-05-09')
  assert.equal(formatIsoDate('2026', '11', '25'), '2026-11-25')
  assert.equal(formatIsoDate('', '5', '9'), '')
})

test('getDaysInMonth returns accurate days for months including leap year', () => {
  assert.equal(getDaysInMonth('2', '2024'), 29) // Leap year
  assert.equal(getDaysInMonth('2', '2026'), 28) // Non-leap year
  assert.equal(getDaysInMonth('4', '2026'), 30) // April
  assert.equal(getDaysInMonth('5', '2026'), 31) // May
})

test('getValidExpirationYears starts at minimum year and extends 30 years', () => {
  const minDate = new Date('2026-11-13T00:00:00')
  const years = getValidExpirationYears(minDate, 5)
  assert.deepEqual(years, ['2026', '2027', '2028', '2029', '2030', '2031'])
})

test('getValidExpirationMonths filters out past months for current year', () => {
  // Current date: 13 Oct 2026 -> min validity date: 13 Nov 2026 (Month 11)
  const minDate = new Date('2026-11-13T00:00:00')
  
  // For current year (2026): months 1 to 10 (including May) MUST be excluded!
  const months2026 = getValidExpirationMonths('2026', false, minDate)
  assert.equal(months2026.length, 2)
  assert.deepEqual(months2026.map(m => m.value), ['11', '12'])
  assert.deepEqual(months2026.map(m => m.label), ['Novembre', 'Décembre'])

  // For future year (2027): all 12 months are valid
  const months2027 = getValidExpirationMonths('2027', false, minDate)
  assert.equal(months2027.length, 12)
  assert.equal(months2027[0].value, '1')
  assert.equal(months2027[4].value, '5') // May is valid in 2027

  // English labels
  const monthsEn = getValidExpirationMonths('2026', true, minDate)
  assert.deepEqual(monthsEn.map(m => m.label), ['November', 'December'])
})

test('getValidExpirationDays filters out past days for current month', () => {
  const minDate = new Date('2026-11-13T00:00:00')
  
  // For 2026-11: days 1 to 12 are excluded, days 13 to 30 are available
  const daysNov = getValidExpirationDays('2026', '11', minDate)
  assert.equal(daysNov.length, 18) // 30 - 13 + 1 = 18 days
  assert.equal(daysNov[0], '13')
  assert.equal(daysNov[daysNov.length - 1], '30')

  // For 2026-12 (future month in current year): all 31 days are available
  const daysDec = getValidExpirationDays('2026', '12', minDate)
  assert.equal(daysDec.length, 31)
  assert.equal(daysDec[0], '1')
  assert.equal(daysDec[30], '31')
})

test('isExpirationDateValid strictly enforces 1 month validity', () => {
  const minDate = new Date('2026-11-13T00:00:00')
  
  // Past date from user screenshot (05 May 2026) -> REJECTED
  assert.equal(isExpirationDateValid('2026-05-05', minDate), false)

  // Current day (13 Oct 2026) -> REJECTED (already expiring / past min threshold)
  assert.equal(isExpirationDateValid('2026-10-13', minDate), false)

  // 12 Nov 2026 (< 1 month) -> REJECTED
  assert.equal(isExpirationDateValid('2026-11-12', minDate), false)

  // Exact boundary 13 Nov 2026 (= 1 month) -> ACCEPTED
  assert.equal(isExpirationDateValid('2026-11-13', minDate), true)

  // Future dates (Dec 2026, May 2027, etc.) -> ACCEPTED
  assert.equal(isExpirationDateValid('2026-12-01', minDate), true)
  assert.equal(isExpirationDateValid('2027-05-05', minDate), true)
  assert.equal(isExpirationDateValid('2030-01-01', minDate), true)

  // Invalid strings -> REJECTED
  assert.equal(isExpirationDateValid('', minDate), false)
  assert.equal(isExpirationDateValid('invalid-date', minDate), false)
})

test('getExpirationErrorMessage returns clean localized message with date', () => {
  const minDate = new Date('2026-11-13T00:00:00')
  const msgFr = getExpirationErrorMessage(false, minDate)
  const msgEn = getExpirationErrorMessage(true, minDate)

  assert.match(msgFr, /validité minimale d'au moins 1 mois/i)
  assert.match(msgFr, /13\/11\/2026/)

  assert.match(msgEn, /minimum validity of at least 1 month/i)
  assert.match(msgEn, /2026-11-13/)
})
