import { test } from 'node:test'
import assert from 'node:assert/strict'
import { translateNotification, translateInnerTerms } from '../src/locales/notificationTranslator.js'

test('translateInnerTerms translates categories and nature to English', () => {
  const input = 'Personne Physique - Salarié secteur privé'
  const result = translateInnerTerms(input, true)
  assert.equal(result, 'Individual - Private sector employee')

  const input2 = 'Personne Morale - Entreprise'
  const result2 = translateInnerTerms(input2, true)
  assert.equal(result2, 'Legal Entity - Company')

  // Untouched if isEn = false
  assert.equal(translateInnerTerms(input, false), input)
})

test('translateNotification preserves French when language is French', () => {
  const notif = {
    title: 'Demande de mise à jour transmise',
    body: "Votre demande de modification (Personne Physique - Salarié secteur privé) a bien été transmise à l'équipe Kori et est en attente de validation."
  }
  const result = translateNotification(notif, false)
  assert.equal(result.title, 'Demande de mise à jour transmise')
  assert.equal(result.body, notif.body)
})

test('translateNotification translates update request from user screenshot into English', () => {
  const notif = {
    title: 'Demande de mise à jour transmise',
    body: "Votre demande de modification (Personne Physique - Salarié secteur privé) a bien été transmise à l'équipe Kori et est en attente de validation."
  }
  const result = translateNotification(notif, true)
  assert.equal(result.title, 'Update request submitted')
  assert.equal(result.body, 'Your update request (Individual - Private sector employee) has been successfully submitted to the Kori team and is pending validation.')
})

test('translateNotification translates bank details submitted notification', () => {
  const notif = {
    title: 'Coordonnées bancaires en cours de validation',
    body: "Vos coordonnées bancaires (Afriland First Bank) ont été envoyées pour vérification par l'équipe Kori."
  }
  const result = translateNotification(notif, true)
  assert.equal(result.title, 'Bank details under review')
  assert.equal(result.body, 'Your bank details (Afriland First Bank) have been submitted for verification by the Kori team.')
})

test('translateNotification translates approval and rejection notifications', () => {
  const approved = {
    title: 'Mise à jour validée ✅',
    body: "Votre demande relative à vos coordonnées bancaires a été validée avec succès par l'équipe Kori."
  }
  const resApproved = translateNotification(approved, true)
  assert.equal(resApproved.title, 'Update approved ✅')
  assert.equal(resApproved.body, 'Your request regarding your bank details has been successfully approved by the Kori team.')

  const rejected = {
    title: 'Mise à jour non validée ⚠️',
    body: "Votre demande de modification (catégorie client) n'a pas été retenue : Document expiré"
  }
  const resRejected = translateNotification(rejected, true)
  assert.equal(resRejected.title, 'Update not approved ⚠️')
  assert.equal(resRejected.body, 'Your change request (client category) was not approved: Document expiré')
})

test('translateNotification translates subscription notifications', () => {
  const subSuccess = {
    title: 'Souscription Validée ✅',
    body: 'Votre souscription TX-12345 pour FCP Kori Croissance a été validée. Vos parts sont créditées.'
  }
  const resSuccess = translateNotification(subSuccess, true)
  assert.equal(resSuccess.title, 'Subscription Confirmed ✅')
  assert.equal(resSuccess.body, 'Your subscription TX-12345 for FCP Kori Croissance has been confirmed. Your shares have been credited.')

  const subFail = {
    title: 'Paiement non abouti ⚠️',
    body: 'Votre paiement pour la souscription TX-99999 (FCP Kori Monétaire) a échoué.'
  }
  const resFail = translateNotification(subFail, true)
  assert.equal(resFail.title, 'Payment Unsuccessful ⚠️')
  assert.equal(resFail.body, 'Your payment for subscription TX-99999 (FCP Kori Monétaire) has failed.')
})
