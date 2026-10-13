/**
 * Dynamic translator for notification titles and bodies.
 * Translates backend notification texts (including historical ones)
 * according to the currently active language.
 */

const titleMapEn = {
  'Demande de mise à jour transmise': 'Update request submitted',
  'Coordonnées bancaires en cours de validation': 'Bank details under review',
  'Mise à jour validée ✅': 'Update approved ✅',
  'Mise à jour validée': 'Update approved',
  'Mise à jour non validée ⚠️': 'Update not approved ⚠️',
  'Mise à jour non validée': 'Update not approved',
  'Souscription Validée ✅': 'Subscription Confirmed ✅',
  'Souscription Validée': 'Subscription Confirmed',
  'Paiement non abouti ⚠️': 'Payment Unsuccessful ⚠️',
  'Paiement non abouti': 'Payment Unsuccessful',
  'Dossier KYC soumis': 'KYC application submitted',
  'Dossier KYC validé': 'KYC application approved',
  'Dossier KYC rejeté': 'KYC application rejected',
  'Demande de modification client': 'Client change request',
}

const termsMapEn = {
  'Personne Physique': 'Individual',
  'Personne Morale': 'Legal Entity',
  'Salarié secteur privé': 'Private sector employee',
  'Salarié secteur public': 'Public sector employee',
  'Profession libérale': 'Self-employed / Professional',
  'Commerçant / Entrepreneur': 'Merchant / Entrepreneur',
  'Retraité': 'Retired',
  'Étudiant': 'Student',
  'Sans emploi': 'Unemployed',
  'Particulier': 'Individual',
  'Entreprise': 'Company',
  'Institutionnel': 'Institutional',
  'coordonnées bancaires': 'bank details',
  'catégorie client': 'client category',
  'nature & catégorie client': 'nature & client category',
}

export const translateInnerTerms = (text, isEn = false) => {
  if (!isEn || !text) return text
  let result = text
  for (const [fr, en] of Object.entries(termsMapEn)) {
    result = result.replaceAll(fr, en)
  }
  return result
}

export const translateNotification = (notif, isEn = false) => {
  if (!notif) return { title: '', body: '' }
  if (!isEn) {
    return {
      title: notif.title || '',
      body: notif.body || ''
    }
  }

  const rawTitle = notif.title || ''
  const rawBody = notif.body || ''

  // Translate title
  const translatedTitle = titleMapEn[rawTitle] || rawTitle

  // Translate body patterns
  let translatedBody = rawBody

  // Pattern 1: Demande de modification (...) a bien été transmise...
  const matchUpdate = rawBody.match(/^Votre demande de modification \((.+?)\) a bien été transmise à l'équipe Kori et est en attente de validation\./i)
  if (matchUpdate) {
    const inner = translateInnerTerms(matchUpdate[1], true)
    translatedBody = `Your update request (${inner}) has been successfully submitted to the Kori team and is pending validation.`
  }

  // Pattern 2: Coordonnées bancaires (...) ont été envoyées...
  const matchBank = rawBody.match(/^Vos coordonnées bancaires \((.+?)\) ont été envoyées pour vérification par l'équipe Kori\./i)
  if (matchBank) {
    translatedBody = `Your bank details (${matchBank[1]}) have been submitted for verification by the Kori team.`
  }

  // Pattern 3: Demande relative à vos (...) a été validée avec succès...
  const matchApproved = rawBody.match(/^Votre demande relative à vos (.+?) a été validée avec succès par l'équipe Kori\./i)
  if (matchApproved) {
    const inner = translateInnerTerms(matchApproved[1], true)
    translatedBody = `Your request regarding your ${inner} has been successfully approved by the Kori team.`
  }

  // Pattern 4: Demande de modification (...) n'a pas été retenue : ...
  const matchRejected = rawBody.match(/^Votre demande de modification \((.+?)\) n'a pas été retenue\s*:\s*(.+)$/i)
  if (matchRejected) {
    const inner = translateInnerTerms(matchRejected[1], true)
    translatedBody = `Your change request (${inner}) was not approved: ${matchRejected[2]}`
  }

  // Pattern 5: Souscription validée
  const matchSub = rawBody.match(/^Votre souscription (.+?) pour (.+?) a été validée\. Vos parts sont créditées\./i)
  if (matchSub) {
    translatedBody = `Your subscription ${matchSub[1]} for ${matchSub[2]} has been confirmed. Your shares have been credited.`
  }

  // Pattern 6: Paiement échoué
  const matchPayFail = rawBody.match(/^Votre paiement pour la souscription (.+?) \((.+?)\) a échoué\./i)
  if (matchPayFail) {
    translatedBody = `Your payment for subscription ${matchPayFail[1]} (${matchPayFail[2]}) has failed.`
  }

  return {
    title: translatedTitle,
    body: translatedBody
  }
}
