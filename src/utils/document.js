/**
 * Convertit toute URL de document (absolue ou relative) en lien relatif frontend pur
 * Évite d'exposer ou de dépendre de l'URL directe du serveur backend.
 */
export const getFrontendDocumentUrl = (url) => {
  if (!url) return ''
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url)
      return parsed.pathname + parsed.search
    }
  } catch (e) {
    // Si échec de parsing, continuer
  }
  return url.startsWith('/') ? url : `/${url}`
}
