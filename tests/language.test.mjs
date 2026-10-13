import { test } from 'node:test'
import assert from 'node:assert/strict'
import { translations } from '../src/locales/translations.js'

test('both French and English translation catalogs are present', () => {
  assert.ok(translations.fr, 'French catalog should exist')
  assert.ok(translations.en, 'English catalog should exist')
})

test('core navigation and UI keys exist in both locales', () => {
  const coreKeys = [
    'nav_home',
    'nav_portfolio',
    'nav_invest',
    'nav_history',
    'nav_settings',
    'welcome_back',
    'login_button',
    'create_account',
    'app_language',
    'select_language',
    'language',
    'subscription_title'
  ]

  for (const key of coreKeys) {
    assert.ok(translations.fr[key], `FR key missing: ${key}`)
    assert.ok(translations.en[key], `EN key missing: ${key}`)
    assert.notEqual(translations.fr[key], '', `FR key empty: ${key}`)
    assert.notEqual(translations.en[key], '', `EN key empty: ${key}`)
  }
})

test('translations between French and English are distinct for common UI text', () => {
  assert.equal(translations.fr.nav_home, 'Accueil')
  assert.equal(translations.en.nav_home, 'Home')
  assert.equal(translations.fr.login_button, 'Se connecter')
  assert.equal(translations.en.login_button, 'Sign in')
  assert.equal(translations.fr.profile_id_not_set, 'Non renseignée')
  assert.equal(translations.en.profile_id_not_set, 'Not provided')
})
