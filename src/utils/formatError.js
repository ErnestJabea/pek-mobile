/**
 * Traduit, simplifie et humanise les erreurs d'API et les limitations de taux (Rate Limiting).
 * Évite les messages techniques brutaux comme "Too Many Attempts." et fournit des explications
 * claires, bienveillantes et parfaitement bilingues (FR / EN).
 */
export function formatErrorMessage(err, fallback = null, overrideLang = null) {
  let isEn = false
  if (overrideLang) {
    isEn = overrideLang === 'en'
  } else if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
    try {
      isEn = (localStorage.getItem('lang') === 'en')
    } catch {
      isEn = false
    }
  }

  // 1. Si aucun paramètre n'est fourni
  if (!err) {
    return fallback || (isEn ? 'An error occurred. Please try again.' : 'Une erreur est survenue. Veuillez réessayer.')
  }

  // 2. Extraire les informations du payload d'erreur
  let rawMsg = typeof err === 'string' ? err : (err.response?.data?.message || err.message || '')
  const status = err.response?.status
  const url = (err.config?.url || '').toLowerCase()

  // 3. Gestion prioritaire du statut HTTP 429 (Trop de tentatives / Rate Limit)
  const isThrottle = status === 429 
    || /too many attempts/i.test(rawMsg) 
    || /too many requests/i.test(rawMsg) 
    || /rate limit/i.test(rawMsg)
    || /trop de tentatives/i.test(rawMsg)

  if (isThrottle) {
    const retryAfter = err.response?.data?.retry_after
    let durationText = isEn ? 'a few moments' : 'quelques instants'
    if (retryAfter && retryAfter > 0) {
      if (retryAfter > 60) {
        const mins = Math.ceil(retryAfter / 60)
        durationText = isEn ? `about ${mins} minute${mins > 1 ? 's' : ''}` : `environ ${mins} minute${mins > 1 ? 's' : ''}`
      } else {
        durationText = isEn ? 'a few moments' : 'quelques instants'
      }
    }

    // Réinitialisation / Changement de mot de passe
    if (url.includes('password') || url.includes('forgot') || url.includes('reset') || /mot de passe/i.test(rawMsg)) {
      return isEn
        ? `You have made several consecutive password requests. For your account security, please wait ${durationText} before trying again.`
        : `Vous avez effectué plusieurs demandes de mot de passe consécutives. Par mesure de sécurité pour votre compte, veuillez patienter ${durationText} avant de réessayer.`
    }

    // Connexion
    if (url.includes('login') || /connexion|sign-in/i.test(rawMsg)) {
      return isEn
        ? `Too many consecutive sign-in attempts were detected. For your account security, please wait ${durationText} before trying again.`
        : `Plusieurs tentatives de connexion consécutives ont été constatées. Par mesure de sécurité pour votre compte, veuillez patienter ${durationText} avant de vous reconnecter.`
    }

    // Inscription
    if (url.includes('register') || /inscription|registration/i.test(rawMsg)) {
      return isEn
        ? `Multiple registration attempts were detected. For security reasons, please wait ${durationText} before submitting your registration again.`
        : `Plusieurs tentatives d'inscription ont été effectuées. Par mesure de sécurité, veuillez patienter ${durationText} avant de renouveler votre inscription.`
    }

    // OTP / Code de sécurité
    if (url.includes('otp') || url.includes('verify') || url.includes('resend') || /code/i.test(rawMsg)) {
      return isEn
        ? `Too many verification code attempts were made. For security reasons, please wait ${durationText} before requesting or entering a new code.`
        : `Vous avez demandé ou saisi trop de codes de vérification consécutifs. Par sécurité, veuillez patienter ${durationText} avant de demander un nouveau code.`
    }

    // Paiement / Souscription
    if (url.includes('payment') || url.includes('subscription')) {
      return isEn
        ? `Multiple payment requests were initiated in a short period. For transaction security, please wait ${durationText} before trying again.`
        : `Plusieurs demandes de paiement ont été initiées en peu de temps. Pour sécuriser votre opération, veuillez patienter ${durationText} avant de réessayer.`
    }

    // Si le message backend est déjà un message clair et humanisé en français/anglais
    if (rawMsg && !/too many attempts/i.test(rawMsg) && !/too many requests/i.test(rawMsg)) {
      return rawMsg
    }

    return isEn
      ? `Too many consecutive attempts. For your security, please wait ${durationText} before trying again.`
      : `Vous avez effectué trop de tentatives consécutives. Par mesure de sécurité, veuillez patienter ${durationText} avant de renouveler votre opération.`
  }

  // 4. Traductions et simplifications de messages techniques courants
  const lower = rawMsg.toLowerCase().trim()
  if (lower === 'unauthenticated.' || lower === 'unauthenticated') {
    return isEn ? 'Your session has expired. Please sign in again.' : 'Votre session a expiré. Veuillez vous reconnecter.'
  }

  if (lower === 'network error' || (!err.response && (err.code === 'ERR_NETWORK' || (typeof navigator !== 'undefined' && !navigator.onLine)))) {
    return isEn ? 'Unable to reach the server. Please check your internet connection.' : 'Impossible de joindre le serveur. Veuillez vérifier votre connexion internet.'
  }

  if (status >= 500) {
    return isEn ? 'Service temporarily unavailable. Please try again in a few moments.' : 'Le service est momentanément indisponible. Veuillez réessayer dans quelques instants.'
  }

  if (lower.includes('these credentials do not match our records') || lower.includes('identifiants invalides')) {
    return isEn ? 'Invalid email or password.' : 'Adresse e-mail ou mot de passe incorrect.'
  }

  if (lower.includes('token is invalid') || lower.includes('token has expired') || lower.includes('lien est invalide') || lower.includes('jeton de réinitialisation')) {
    return isEn ? 'This reset link is invalid or has expired. Please request a new one.' : 'Ce lien de réinitialisation est invalide ou a expiré. Veuillez faire une nouvelle demande.'
  }

  if (lower.includes('the given data was invalid') || lower.includes('validation error')) {
    return isEn ? 'Please check the information entered.' : 'Veuillez vérifier les informations saisies.'
  }

  // Si on a un fallback spécifique et pas de message backend explicite
  if (!rawMsg && fallback) {
    return fallback
  }

  return rawMsg || fallback || (isEn ? 'An error occurred. Please try again.' : 'Une erreur est survenue. Veuillez réessayer.')
}
